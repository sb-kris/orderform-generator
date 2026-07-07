/**
 * Order-form PDF renderer (Final + Fillable variants).
 *
 * Mode summary
 * ------------
 *  1. **Final PDF** – every value is static text, `PDFForm.flatten()` runs
 *     before save. Blocked by validation upstream.
 *  2. **Fillable PDF** – customer signature/name/designation/date + PO fields
 *     stay editable. PO Required is a single `PDFRadioGroup` (`po.required`)
 *     with options `Yes | No` – mutually exclusive by construction.
 *  3. **True e-signature workflows** are *not* implemented; use DocuSign,
 *     Adobe Sign, or PandaDoc for signer identity + audit trail.
 */
import {
  COLORS,
  CONTENT_W,
  PAGE,
  createLayout,
  drawFooters,
  drawLabeledFields,
  drawRoundedRect,
  drawSectionHeading,
  drawWrappedText,
  ensureSpace,
  keepTogether,
  sanitizeText,
  truncate,
  wrapText,
  type Layout,
} from './layout'
import type { ImageAsset, OrderFormData, Signature } from '@/state/types'
import { buildDocModel, type DocModel } from '@/lib/docModel'
import { formatDate } from '@/lib/format'
import { TERMS } from '@/lib/terms'
import type { PDFImage } from 'pdf-lib'

type Mode = 'final' | 'fillable'

export async function renderOrderForm(
  data: OrderFormData,
  mode: Mode,
): Promise<Uint8Array> {
  const model = buildDocModel(data)
  const title = `SurveySparrow Order Form – ${model.customer.legalName || 'Draft'}${
    mode === 'fillable' ? ' (Fillable)' : ''
  }`

  // Decode the optional customer logo (data URL) into bytes for embedding.
  let logoBytes: Uint8Array | null = null
  let logoMime: 'image/png' | 'image/jpeg' | null = null
  if (data.customerLogo?.dataUrl) {
    const decoded = decodeDataUrl(data.customerLogo.dataUrl)
    if (decoded) {
      logoBytes = decoded.bytes
      logoMime = decoded.mime === 'image/jpeg' ? 'image/jpeg' : 'image/png'
    }
  }

  const layout = await createLayout(title, model.documentId, logoBytes, logoMime)

  const custSigImg = await maybeEmbedImage(
    layout,
    data.signature.customer.type === 'image' ? data.signature.customer.image : null,
  )
  const ssSigImg = await maybeEmbedImage(
    layout,
    data.signature.surveysparrow.type === 'image'
      ? data.signature.surveysparrow.image
      : null,
  )

  drawTitleBlock(layout)
  renderCustomer(layout, model)
  renderSoldTo(layout, model)
  renderServices(layout, model)
  renderBillingShipping(layout, model)
  renderSubscription(layout, model)
  renderTerms(layout)
  renderExecutionAndPurchaseOrder(layout, data, model, mode, custSigImg, ssSigImg)

  drawFooters(layout)

  if (mode === 'final') {
    try {
      layout.doc.getForm().flatten()
    } catch {
      /* no form to flatten */
    }
  } else {
    const form = layout.doc.getForm()
    form.updateFieldAppearances(layout.fonts.regular)
  }

  return await layout.doc.save({ useObjectStreams: false })
}

async function maybeEmbedImage(
  layout: Layout,
  asset: ImageAsset | null,
): Promise<PDFImage | null> {
  if (!asset?.dataUrl) return null
  const decoded = decodeDataUrl(asset.dataUrl)
  if (!decoded) return null
  try {
    if (decoded.mime === 'image/jpeg') return await layout.doc.embedJpg(decoded.bytes)
    if (decoded.mime === 'image/png') return await layout.doc.embedPng(decoded.bytes)
    return null
  } catch {
    return null
  }
}

function decodeDataUrl(url: string): { bytes: Uint8Array; mime: string } | null {
  const m = /^data:([^;]+);base64,(.+)$/.exec(url)
  if (!m) return null
  const mime = m[1]
  let raw: string
  try {
    raw = atob(m[2])
  } catch {
    return null
  }
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  return { bytes, mime }
}

// -------- Title block --------------------------------------------------------

function drawTitleBlock(l: Layout) {
  l.page.drawText('SURVEYSPARROW INC', {
    x: PAGE.marginX,
    y: l.y - 2,
    size: 8,
    font: l.fonts.display,
    color: COLORS.teal,
  })
  l.y -= 10

  l.page.drawText('Service Order Form', {
    x: PAGE.marginX,
    y: l.y - 24,
    size: 28,
    font: l.fonts.display,
    color: COLORS.slate950,
  })

  // Optional customer logo, right-aligned beside the title. Small, aspect
  // preserved, no caption — the customer's name belongs in the form body,
  // not under the logo.
  if (l.customerLogo) {
    const maxH = 30
    const maxW = 120
    const ratio = l.customerLogo.width / l.customerLogo.height
    let h = maxH
    let w = h * ratio
    if (w > maxW) {
      w = maxW
      h = w / ratio
    }
    l.page.drawImage(l.customerLogo, {
      x: PAGE.width - PAGE.marginX - w,
      y: l.y - 22,
      width: w,
      height: h,
    })
  }

  l.y -= 38
  l.page.drawLine({
    start: { x: PAGE.marginX, y: l.y },
    end: { x: PAGE.width - PAGE.marginX, y: l.y },
    color: COLORS.slate200,
    thickness: 0.7,
  })
  l.y -= 10
}

// -------- Sections -----------------------------------------------------------

function renderCustomer(l: Layout, m: DocModel) {
  drawSectionHeading(l, '01', 'Customer Information')
  drawLabeledFields(l, [
    { label: "Customer's Legal Name", value: m.customer.legalName, required: true, span: 2 },
    { label: 'Order Form Date', value: m.customer.orderFormDate, required: true },
    { label: 'Pricing Valid Through', value: m.customer.pricingValidThrough, required: true },
    { label: 'Prepared By', value: m.customer.preparedBy, required: true, span: 2 },
  ])
}

function renderSoldTo(l: Layout, m: DocModel) {
  drawSectionHeading(l, '02', 'Sold To')
  drawLabeledFields(l, [
    { label: 'Name', value: m.soldTo.name, required: true },
    { label: 'Email', value: m.soldTo.email, required: true },
  ])
}

function renderServices(l: Layout, m: DocModel) {
  drawSectionHeading(l, '03', 'Services')

  const cols = [
    { label: 'Line Item', width: 288, align: 'left' as const },
    { label: 'Price', width: 88, align: 'right' as const },
    { label: 'Quantity', width: 60, align: 'center' as const },
    { label: 'Sub-Total', width: CONTENT_W - 288 - 88 - 60, align: 'right' as const },
  ]

  const headerH = 22
  const rowH = 22

  keepTogether(l, headerH + rowH * Math.min(m.services.length + 1, 6) + 24)

  let x = PAGE.marginX
  cols.forEach((c) => {
    const label = c.label.toUpperCase()
    const w = l.fonts.bold.widthOfTextAtSize(label, 7.5)
    const tx =
      c.align === 'right'
        ? x + c.width - w - 12
        : c.align === 'center'
          ? x + (c.width - w) / 2
          : x + 12
    l.page.drawText(label, {
      x: tx,
      y: l.y - 14,
      size: 7.5,
      font: l.fonts.bold,
      color: COLORS.slate950,
    })
    x += c.width
  })
  l.page.drawLine({
    start: { x: PAGE.marginX, y: l.y - headerH + 2 },
    end: { x: PAGE.width - PAGE.marginX, y: l.y - headerH + 2 },
    color: COLORS.slate950,
    thickness: 1.4,
  })
  l.y -= headerH

  if (m.services.length === 0) {
    l.page.drawText('Add a line item to include Services in this document.', {
      x: PAGE.marginX + 12,
      y: l.y - rowH + 8,
      size: 9,
      font: l.fonts.regular,
      color: COLORS.slate400,
    })
    l.y -= rowH
  } else {
    m.services.forEach((r) => {
      ensureSpace(l, rowH)
      let cx = PAGE.marginX
      const cells = [r.description, r.priceLabel, r.quantityLabel, r.subtotalLabel]
      cols.forEach((c, i) => {
        const text = cells[i]
        if (text) {
          const font = i === 0 ? l.fonts.medium : l.fonts.medium
          const size = 9
          const display = truncate(sanitizeText(text), font, size, c.width - 24)
          const w = font.widthOfTextAtSize(display, size)
          const tx =
            c.align === 'right'
              ? cx + c.width - w - 12
              : c.align === 'center'
                ? cx + (c.width - w) / 2
                : cx + 12
          l.page.drawText(display, {
            x: tx,
            y: l.y - rowH + 8,
            size,
            font,
            color: COLORS.slate950,
          })
        }
        cx += c.width
      })
      l.page.drawLine({
        start: { x: PAGE.marginX, y: l.y - rowH },
        end: { x: PAGE.width - PAGE.marginX, y: l.y - rowH },
        color: COLORS.slate200,
        thickness: 0.5,
      })
      l.y -= rowH
    })
  }

  // Total row
  ensureSpace(l, rowH + 4)
  const totalTop = l.y
  l.page.drawRectangle({
    x: PAGE.marginX,
    y: totalTop - rowH,
    width: CONTENT_W,
    height: rowH,
    color: COLORS.tealSoft,
  })
  l.page.drawLine({
    start: { x: PAGE.marginX, y: totalTop },
    end: { x: PAGE.width - PAGE.marginX, y: totalTop },
    color: COLORS.teal,
    thickness: 1.4,
  })
  const totalLabel = 'TOTAL'
  l.page.drawText(totalLabel, {
    x:
      PAGE.marginX +
      CONTENT_W -
      cols[3].width -
      12 -
      l.fonts.bold.widthOfTextAtSize(totalLabel, 9),
    y: totalTop - rowH + 8,
    size: 9,
    font: l.fonts.bold,
    color: COLORS.slate700,
  })
  const totalStr = sanitizeText(m.totalLabel)
  const tw = l.fonts.display.widthOfTextAtSize(totalStr, 11)
  l.page.drawText(totalStr, {
    x: PAGE.marginX + CONTENT_W - tw - 12,
    y: totalTop - rowH + 7,
    size: 11,
    font: l.fonts.display,
    color: COLORS.slate950,
  })
  l.y = totalTop - rowH - 6
}

const ADDRESS_MAX_LINES = 6

function renderBillingShipping(l: Layout, m: DocModel) {
  const cardW = (CONTENT_W - 16) / 2

  // Wrap both addresses up-front so the cards can grow with their content
  // instead of silently dropping lines. Cap at ADDRESS_MAX_LINES with an
  // ellipsis on the final line — six wrapped lines covers any real-world
  // postal address.
  const wrapAddress = (address: string): string[] => {
    const lines = wrapText(address || '', l.fonts.medium, 8.5, cardW - 44)
    if (lines.length > ADDRESS_MAX_LINES) {
      const kept = lines.slice(0, ADDRESS_MAX_LINES)
      kept[ADDRESS_MAX_LINES - 1] = truncate(
        kept[ADDRESS_MAX_LINES - 1] + ' ' + lines[ADDRESS_MAX_LINES],
        l.fonts.medium,
        8.5,
        cardW - 44,
      )
      return kept
    }
    return lines
  }
  const billLines = wrapAddress(m.billTo.address)
  const shipLines = wrapAddress(m.shipTo.address)
  const lineCount = Math.max(billLines.length, shipLines.length, 3)
  const addrPillH = 8 + lineCount * 10
  const cardH = 86 + addrPillH

  keepTogether(l, cardH + 40)
  drawSectionHeading(l, '04', 'Billing & Shipping')

  const startY = l.y
  drawAddressCard(l, {
    x: PAGE.marginX,
    y: startY,
    width: cardW,
    height: cardH,
    addrPillH,
    label: 'BILL TO',
    name: m.billTo.name,
    addressLines: billLines,
  })
  drawAddressCard(l, {
    x: PAGE.marginX + cardW + 16,
    y: startY,
    width: cardW,
    height: cardH,
    addrPillH,
    label: 'SHIP TO',
    name: m.shipTo.name,
    addressLines: shipLines,
  })
  l.y = startY - cardH - 8
}

function drawAddressCard(
  l: Layout,
  opts: {
    x: number
    y: number
    width: number
    height: number
    addrPillH: number
    label: string
    name: string
    addressLines: string[]
  },
) {
  const { x, y, width, height, addrPillH, label, name, addressLines } = opts
  drawRoundedRect(l.page, {
    x,
    y: y - height,
    width,
    height,
    radius: 6,
    color: COLORS.white,
    borderColor: COLORS.slate200,
    borderWidth: 0.7,
  })
  l.page.drawText(label, {
    x: x + 14,
    y: y - 16,
    size: 8,
    font: l.fonts.bold,
    color: COLORS.teal,
  })
  l.page.drawText('NAME  *', {
    x: x + 14,
    y: y - 32,
    size: 6.5,
    font: l.fonts.bold,
    color: COLORS.slate500,
  })
  const namePillY = y - 54
  drawRoundedRect(l.page, {
    x: x + 14,
    y: namePillY,
    width: width - 28,
    height: 18,
    radius: 4,
    color: COLORS.white,
    borderColor: name ? COLORS.slate200 : COLORS.tealSoft,
    borderWidth: 0.6,
  })
  const nameText = name || `{{${label.replace(/[^\w]+/g, '_')}_Name}}`
  l.page.drawText(truncate(sanitizeText(nameText), l.fonts.medium, 9, width - 44), {
    x: x + 22,
    y: namePillY + 5,
    size: 9,
    font: name ? l.fonts.medium : l.fonts.regular,
    color: name ? COLORS.slate950 : COLORS.teal,
  })
  l.page.drawText('ADDRESS  *', {
    x: x + 14,
    y: y - 70,
    size: 6.5,
    font: l.fonts.bold,
    color: COLORS.slate500,
  })
  const addrPillY = y - 74 - addrPillH
  drawRoundedRect(l.page, {
    x: x + 14,
    y: addrPillY,
    width: width - 28,
    height: addrPillH,
    radius: 4,
    color: COLORS.white,
    borderColor: addressLines.length ? COLORS.slate200 : COLORS.tealSoft,
    borderWidth: 0.6,
  })
  if (addressLines.length === 0) {
    l.page.drawText(`{{${label.replace(/[^\w]+/g, '_')}_Address}}`, {
      x: x + 22,
      y: addrPillY + addrPillH - 12,
      size: 9,
      font: l.fonts.regular,
      color: COLORS.teal,
    })
  } else {
    let ay = addrPillY + addrPillH - 10
    for (const ln of addressLines) {
      l.page.drawText(ln, {
        x: x + 22,
        y: ay,
        size: 8.5,
        font: l.fonts.medium,
        color: COLORS.slate950,
      })
      ay -= 10
    }
  }
}

function renderSubscription(l: Layout, m: DocModel) {
  drawSectionHeading(l, '05', 'Subscription Details')
  drawLabeledFields(l, [
    { label: 'Billing Period', value: m.subscription.billingPeriod, required: true },
    { label: 'Subscription Term (Months)', value: m.subscription.termMonths, required: true },
    { label: 'Start Date', value: m.subscription.startDate, required: true },
    { label: 'Payment Method', value: m.subscription.paymentMethod, required: true },
  ])
  drawWrappedText(l, 'Payable within 30 days upon the receipt of invoice.', {
    weight: 'oblique',
    size: 9,
    color: COLORS.slate600,
  })
  l.y -= 2
}

function renderTerms(l: Layout) {
  drawSectionHeading(l, '06', 'Terms & Conditions')

  let lastPageIndex = l.pages.length - 1
  TERMS.forEach((t) => {
    keepTogether(l, 28)
    if (l.pages.length - 1 !== lastPageIndex) {
      drawSectionHeading(l, '06', 'Terms & Conditions', true)
      lastPageIndex = l.pages.length - 1
    }
    drawWrappedText(l, t.title, {
      weight: 'bold',
      size: 9.5,
      color: COLORS.slate950,
    })
    t.paragraphs.forEach((p) => {
      const prev = l.pages.length - 1
      drawWrappedText(l, p, { size: 8.75, leading: 12.25, color: COLORS.slate700 })
      if (l.pages.length - 1 !== prev) lastPageIndex = l.pages.length - 1
    })
    l.y -= 4
  })
}

// -------- Execution + Purchase Order ------------------------------------------

function renderExecutionAndPurchaseOrder(
  l: Layout,
  data: OrderFormData,
  m: DocModel,
  mode: Mode,
  custSigImg: PDFImage | null,
  ssSigImg: PDFImage | null,
) {
  const cardH = 176
  // Reserve the heading + intro + both signature cards so the cards never
  // orphan across a page break — but NOT the whole section, so the block can
  // flow onto the current page when there's room instead of leaving a
  // half-empty page behind it.
  keepTogether(l, 34 + 24 + cardH)
  drawSectionHeading(l, '07', 'Execution / Signature')

  drawWrappedText(
    l,
    'By signing below, each party agrees to the terms of this Order Form and represents that its signatory is authorised to bind it.',
    { size: 8.5, color: COLORS.slate600, leading: 11 },
  )
  l.y -= 4

  const cardW = (CONTENT_W - 16) / 2
  const startY = l.y
  drawSignatureCard(l, {
    x: PAGE.marginX,
    y: startY,
    width: cardW,
    height: cardH,
    heading: 'CUSTOMER',
    subheading: m.customer.legalName || 'Customer',
    signature: data.signature.customer,
    signatureImage: custSigImg,
    fillable: mode === 'fillable',
    fieldPrefix: 'customer',
  })
  drawSignatureCard(l, {
    x: PAGE.marginX + cardW + 16,
    y: startY,
    width: cardW,
    height: cardH,
    heading: 'SURVEYSPARROW INC.',
    subheading: '2345 Yale Street, Palo Alto, CA',
    signature: data.signature.surveysparrow,
    signatureImage: ssSigImg,
    fillable: false,
  })
  l.y = startY - cardH - 14

  // Purchase Order is compact — keep its heading and row together so it moves
  // cleanly as a unit rather than splitting a heading from its content.
  keepTogether(l, 34 + 46 + 30)
  drawSectionHeading(l, '08', 'Purchase Order')
  drawPurchaseOrderRow(l, data, m, mode)

  // Elegant closing mark instead of a legal disclaimer — a centered rule
  // that signals the end of the document and gives the final page a
  // deliberate, finished feel.
  drawClosingMark(l)
}

/** Centered "END OF ORDER FORM" rule that closes out the final page. */
function drawClosingMark(l: Layout) {
  l.y -= 26
  ensureSpace(l, 24)
  const y = l.y
  const label = 'END OF ORDER FORM'
  const size = 7
  const tw = l.fonts.bold.widthOfTextAtSize(label, size)
  const cx = (PAGE.width - tw) / 2
  const gap = 14
  const inset = 60
  l.page.drawLine({
    start: { x: PAGE.marginX + inset, y: y },
    end: { x: cx - gap, y: y },
    color: COLORS.slate200,
    thickness: 0.6,
  })
  l.page.drawText(label, {
    x: cx,
    y: y - 2.5,
    size,
    font: l.fonts.bold,
    color: COLORS.slate400,
  })
  l.page.drawLine({
    start: { x: cx + tw + gap, y: y },
    end: { x: PAGE.width - PAGE.marginX - inset, y: y },
    color: COLORS.slate200,
    thickness: 0.6,
  })
}

function drawSignatureCard(
  l: Layout,
  opts: {
    x: number
    y: number
    width: number
    height: number
    heading: string
    subheading: string
    signature: Signature
    signatureImage: PDFImage | null
    fillable: boolean
    fieldPrefix?: string
  },
) {
  const {
    x,
    y,
    width,
    height,
    heading,
    subheading,
    signature,
    signatureImage,
    fillable,
    fieldPrefix,
  } = opts
  const page = l.page
  const isCustomer = !!fieldPrefix

  // Card shell
  drawRoundedRect(page, {
    x,
    y: y - height,
    width,
    height,
    radius: 6,
    color: COLORS.white,
    borderColor: COLORS.slate200,
    borderWidth: 0.8,
  })

  // Header band – teal-tinted for the customer, slate for SurveySparrow, so
  // the two parties are visually distinct at a glance.
  const bandH = 26
  drawRoundedRect(page, {
    x: x + 1,
    y: y - bandH,
    width: width - 2,
    height: bandH - 1,
    radius: 5,
    color: isCustomer ? COLORS.tealSoft : COLORS.slate100,
  })
  page.drawText(heading, {
    x: x + 14,
    y: y - 12,
    size: 8,
    font: l.fonts.bold,
    color: isCustomer ? COLORS.tealDeep : COLORS.slate700,
  })
  page.drawText(truncate(sanitizeText(subheading), l.fonts.regular, 7, width - 28), {
    x: x + 14,
    y: y - 21,
    size: 7,
    font: l.fonts.regular,
    color: COLORS.slate500,
  })

  // Signature zone – open area with a baseline rule, like a paper form.
  const sigLabelY = y - bandH - 14
  page.drawText('SIGNATURE', {
    x: x + 14,
    y: sigLabelY,
    size: 6.5,
    font: l.fonts.bold,
    color: COLORS.slate500,
  })
  const sigBaseY = y - bandH - 56
  page.drawLine({
    start: { x: x + 14, y: sigBaseY },
    end: { x: x + width - 14, y: sigBaseY },
    color: COLORS.slate400,
    thickness: 0.8,
  })

  if (signatureImage) {
    // Center the image within the signature box (between the SIGNATURE label
    // and the baseline rule), aspect preserved, capped in both dimensions so
    // it never dwarfs or gets lost in the card. Sits just above the baseline
    // like an ink signature.
    const boxTop = sigLabelY - 10
    const boxBottom = sigBaseY
    const boxH = boxTop - boxBottom
    const maxW = width - 40
    const maxH = boxH - 2
    const ratio = signatureImage.width / signatureImage.height
    let iw = maxW
    let ih = iw / ratio
    if (ih > maxH) {
      ih = maxH
      iw = ih * ratio
    }
    page.drawImage(signatureImage, {
      x: x + (width - iw) / 2,
      y: boxBottom + (boxH - ih) / 2,
      width: iw,
      height: ih,
    })
  } else if (fillable && fieldPrefix) {
    const form = l.doc.getForm()
    const sigField = form.createTextField(`${fieldPrefix}.signature`)
    // Field values are sanitized too: addToPage builds the initial appearance
    // stream with WinAnsi Helvetica, which throws on any non-WinAnsi char
    // (₹, CJK, …) and would abort the whole fillable export.
    sigField.setText(sanitizeText(signature.signatureName || ''))
    sigField.addToPage(page, {
      x: x + 14,
      y: sigBaseY + 2,
      width: width - 28,
      height: 34,
      borderWidth: 0,
    })
  } else if (signature.signatureName) {
    // Typed signature in Great Vibes (calligraphic but legible), auto-fitted:
    // start at a natural signature size and shrink until the name fits the
    // line, clamped so short names don't balloon and long names stay legible.
    const font = l.fonts.script ?? l.fonts.oblique
    const maxSize = l.fonts.script ? 17 : 13
    const minSize = 11
    const text = sanitizeText(signature.signatureName)
    const maxW = width - 56
    let size = maxSize
    while (size > minSize && font.widthOfTextAtSize(text, size) > maxW) {
      size -= 0.5
    }
    const display =
      font.widthOfTextAtSize(text, size) > maxW
        ? truncate(text, font, size, maxW)
        : text
    page.drawText(display, {
      x: x + 22,
      y: sigBaseY + 6,
      size,
      font,
      color: COLORS.slate900,
    })
  }

  // Name / Designation / Date rows: caption + value over a hairline rule.
  const rows: Array<{ label: string; value: string; fieldName?: string }> = [
    {
      label: 'NAME',
      value: signature.name,
      fieldName: fillable && fieldPrefix ? `${fieldPrefix}.name` : undefined,
    },
    {
      label: 'DESIGNATION',
      value: signature.designation,
      fieldName: fillable && fieldPrefix ? `${fieldPrefix}.designation` : undefined,
    },
    {
      label: 'DATE',
      value: formatDate(signature.date),
      fieldName: fillable && fieldPrefix ? `${fieldPrefix}.date` : undefined,
    },
  ]
  const rowH = 27
  let ry = sigBaseY - 12
  rows.forEach((r) => {
    page.drawText(r.label, {
      x: x + 14,
      y: ry - 4,
      size: 6.5,
      font: l.fonts.bold,
      color: COLORS.slate500,
    })
    const valueBaseY = ry - 19
    if (r.fieldName) {
      const form = l.doc.getForm()
      const tf = form.createTextField(r.fieldName)
      tf.setText(sanitizeText(r.value || ''))
      tf.addToPage(page, {
        x: x + 14,
        y: valueBaseY - 2,
        width: width - 28,
        height: 14,
        borderWidth: 0,
      })
      page.drawLine({
        start: { x: x + 14, y: valueBaseY - 3 },
        end: { x: x + width - 14, y: valueBaseY - 3 },
        color: COLORS.slate300,
        thickness: 0.6,
      })
    } else {
      if (r.value) {
        page.drawText(truncate(sanitizeText(r.value), l.fonts.medium, 9, width - 36), {
          x: x + 14,
          y: valueBaseY,
          size: 9,
          font: l.fonts.medium,
          color: COLORS.slate950,
        })
      }
      page.drawLine({
        start: { x: x + 14, y: valueBaseY - 3 },
        end: { x: x + width - 14, y: valueBaseY - 3 },
        color: COLORS.slate300,
        thickness: 0.6,
      })
    }
    ry -= rowH
  })
}

function drawPurchaseOrderRow(
  l: Layout,
  data: OrderFormData,
  m: DocModel,
  mode: Mode,
) {
  const startY = l.y
  const page = l.page
  const rowH = 44
  const colW = (CONTENT_W - 24) / 3
  const columns = [
    { label: 'PO REQUIRED', x: PAGE.marginX, w: colW },
    { label: 'PO NUMBER', x: PAGE.marginX + colW + 12, w: colW },
    { label: m.po.amountHeading.toUpperCase(), x: PAGE.marginX + (colW + 12) * 2, w: colW },
  ]

  columns.forEach((c) => {
    page.drawText(c.label, {
      x: c.x,
      y: startY - 8,
      size: 6.5,
      font: l.fonts.bold,
      color: COLORS.slate500,
    })
  })
  const valueY = startY - 30
  const valueH = 20

  if (mode === 'fillable') {
    const form = l.doc.getForm()
    const radio = form.createRadioGroup('po.required')
    const yesX = columns[0].x
    const noX = columns[0].x + 60
    radio.addOptionToPage('Yes', page, { x: yesX, y: valueY, width: 14, height: 14 })
    radio.addOptionToPage('No', page, { x: noX, y: valueY, width: 14, height: 14 })
    page.drawText('Yes', {
      x: yesX + 20,
      y: valueY + 2,
      size: 9.5,
      font: l.fonts.medium,
      color: COLORS.slate900,
    })
    page.drawText('No', {
      x: noX + 20,
      y: valueY + 2,
      size: 9.5,
      font: l.fonts.medium,
      color: COLORS.slate900,
    })
    radio.select(data.purchaseOrder.required)

    drawRoundedRect(page, {
      x: columns[1].x,
      y: valueY - 2,
      width: columns[1].w,
      height: valueH,
      radius: 4,
      color: COLORS.white,
      borderColor: COLORS.tealSoft,
      borderWidth: 0.6,
    })
    const num = form.createTextField('po.number')
    num.setText(sanitizeText(data.purchaseOrder.number || ''))
    num.addToPage(page, {
      x: columns[1].x + 2,
      y: valueY,
      width: columns[1].w - 4,
      height: valueH - 4,
      borderWidth: 0,
    })

    drawRoundedRect(page, {
      x: columns[2].x,
      y: valueY - 2,
      width: columns[2].w,
      height: valueH,
      radius: 4,
      color: COLORS.white,
      borderColor: COLORS.tealSoft,
      borderWidth: 0.6,
    })
    const amt = form.createTextField('po.amount')
    amt.setText(m.po.amountLabel === '—' ? '' : sanitizeText(m.po.amountLabel))
    amt.addToPage(page, {
      x: columns[2].x + 2,
      y: valueY,
      width: columns[2].w - 4,
      height: valueH - 4,
      borderWidth: 0,
    })
  } else {
    const values = [m.po.required, m.po.numberLabel, m.po.amountLabel]
    columns.forEach((c, i) => {
      drawRoundedRect(page, {
        x: c.x,
        y: valueY - 2,
        width: c.w,
        height: valueH,
        radius: 4,
        color: COLORS.white,
        borderColor: COLORS.slate200,
        borderWidth: 0.6,
      })
      page.drawText(sanitizeText(values[i]), {
        x: c.x + 10,
        y: valueY + 3,
        size: 10,
        font: l.fonts.medium,
        color: COLORS.slate950,
      })
    })
  }

  l.y = startY - rowH - 2
}
