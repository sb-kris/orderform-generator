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
  newPage,
  sanitizeText,
  truncate,
  wrapText,
  type Layout,
} from './layout'
import { PAYMENT_METHODS, type ImageAsset, type OrderFormData, type Signature } from '@/state/types'
import { buildDocModel, type DocModel } from '@/lib/docModel'
import { formatDate } from '@/lib/format'
import { buildTerms, type TermClause } from '@/lib/terms'
import { TEMPLATE_VERSION } from '@/lib/exports/exportModes'
import { degrees, PDFName, PDFString, type PDFField, type PDFImage } from 'pdf-lib'

/**
 * Attach a hover tooltip (the AcroForm `/TU` "user name" entry) to a field.
 * pdf-lib 1.17.1 has no high-level setter, so we write the dict entry directly.
 * Best-effort — a failure here must never abort an export.
 */
function setFieldTooltip(field: PDFField, text: string) {
  try {
    field.acroField.dict.set(PDFName.of('TU'), PDFString.of(text))
  } catch {
    /* tooltip is a nice-to-have */
  }
}

/**
 * `draft`    – flattened static text with a diagonal DRAFT watermark; permissive.
 * `final`    – flattened, no watermark; the customer-ready artefact.
 * `fillable` – customer signature/name/designation/date + PO fields stay editable.
 */
export type Mode = 'final' | 'fillable' | 'draft'

export async function renderOrderForm(
  data: OrderFormData,
  mode: Mode,
): Promise<Uint8Array> {
  const model = buildDocModel(data)
  const kindSuffix =
    mode === 'fillable' ? ' (Fillable)' : mode === 'draft' ? ' (Draft)' : ''
  const title = `Service Order Form – ${model.customer.legalName || 'Draft'}${kindSuffix}`

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
  renderSubscription(layout, model, mode)
  renderTerms(layout, buildTerms(data.subscription, data.termOverrides ?? {}))
  renderCommentsBlock(layout, mode, {
    label: 'CUSTOMER COMMENTS ON TERMS & CONDITIONS, IF ANY',
    fieldName: 'terms.comments',
    tooltip: 'Customer comments on Terms & Conditions, if any.',
    comments: model.termsComments,
  })
  renderExecutionAndPurchaseOrder(layout, data, model, mode, custSigImg, ssSigImg)

  drawFooters(layout)

  if (mode === 'draft') drawDraftWatermark(layout)

  setDocumentMetadata(layout, model, mode)

  if (mode === 'fillable') {
    const form = layout.doc.getForm()
    form.updateFieldAppearances(layout.fonts.regular)
  } else {
    // Final + Draft are flattened so no stray editable fields remain.
    try {
      layout.doc.getForm().flatten()
    } catch {
      /* no form to flatten */
    }
  }

  // NB: pdf-lib overwrites the Producer field with its own name on save (the
  // `updateMetadata` opt-out isn't available in this version). Title/Author/
  // Creator/Subject/Keywords are all set to SurveySparrow and are Quill-free —
  // only the low-signal Producer shows the library name.
  return await layout.doc.save({ useObjectStreams: false })
}

/**
 * Complete PDF metadata (pdf-lib sets a few defaults in `createLayout`; this
 * fills in keywords/producer/dates and a per-customer title/subject so the
 * file reads correctly in a reader's Properties dialog and in search).
 */
function setDocumentMetadata(layout: Layout, model: DocModel, mode: Mode) {
  const doc = layout.doc
  const customer = model.customer.legalName || 'Draft'
  const now = new Date()
  doc.setTitle(`SurveySparrow Service Order Form - ${customer}`)
  doc.setAuthor('SurveySparrow')
  doc.setSubject('Service Order Form')
  doc.setKeywords([
    'SurveySparrow',
    'Order Form',
    customer,
    model.documentId,
    `Template ${TEMPLATE_VERSION}`,
    mode === 'fillable' ? 'Fillable' : mode === 'draft' ? 'Draft' : 'Final',
  ])
  doc.setCreator('SurveySparrow')
  doc.setProducer('SurveySparrow')
  doc.setCreationDate(now)
  doc.setModificationDate(now)
}

/** Diagonal, low-opacity DRAFT stamp across every page of a Draft export. */
function drawDraftWatermark(l: Layout) {
  const text = 'DRAFT'
  const size = 120
  const font = l.fonts.display
  const textW = font.widthOfTextAtSize(text, size)
  // Centre the rotated baseline roughly on the page middle.
  const cx = PAGE.width / 2
  const cy = PAGE.height / 2
  const rad = (45 * Math.PI) / 180
  const x = cx - (textW / 2) * Math.cos(rad) + (size / 2) * Math.sin(rad)
  const y = cy - (textW / 2) * Math.sin(rad) - (size / 2) * Math.cos(rad)
  l.pages.forEach((page) => {
    page.drawText(text, {
      x,
      y,
      size,
      font,
      color: COLORS.slate400,
      rotate: degrees(45),
      opacity: 0.12,
    })
  })
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
    { label: 'Line Item', width: 244, align: 'left' as const },
    { label: 'Price', width: 88, align: 'right' as const },
    // Wider than a bare quantity so a 6-char unit (e.g. "1000 EMAILS") fits.
    { label: 'Qty / Unit', width: 104, align: 'center' as const },
    { label: 'Sub-Total', width: CONTENT_W - 244 - 88 - 104, align: 'right' as const },
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

function renderSubscription(l: Layout, m: DocModel, mode: Mode) {
  const fillable = mode === 'fillable'
  drawSectionHeading(l, '05', 'Subscription Details')
  drawLabeledFields(
    l,
    [
      { label: 'Billing Period', value: m.subscription.billingPeriod, required: true },
      { label: 'Subscription Term (Months)', value: m.subscription.termMonths, required: true },
      // Optional — editable in the Fillable PDF, blank pill (no placeholder) elsewhere.
      {
        label: 'Start Date',
        value: m.subscription.startDate,
        optional: true,
        field: fillable
          ? { name: 'subscription.startDate', kind: 'text', tooltip: 'Subscription start date (dd/mm/yyyy)' }
          : undefined,
      },
      {
        label: 'Payment Method',
        value: m.subscription.paymentMethod,
        optional: true,
        field: fillable
          ? { name: 'subscription.paymentMethod', kind: 'dropdown', options: PAYMENT_METHODS, tooltip: 'Select payment method' }
          : undefined,
      },
    ],
    2,
    fillable,
  )
  // Payment terms as a subtle callout (teal-tinted strip with an accent bar)
  // rather than a loose italic line — more scannable, still formal.
  ensureSpace(l, 26)
  const cy = l.y
  const calloutH = 20
  drawRoundedRect(l.page, {
    x: PAGE.marginX,
    y: cy - calloutH,
    width: CONTENT_W,
    height: calloutH,
    radius: 4,
    color: COLORS.tealSoft,
  })
  l.page.drawRectangle({
    x: PAGE.marginX,
    y: cy - calloutH,
    width: 2.5,
    height: calloutH,
    color: COLORS.teal,
  })
  l.page.drawText(sanitizeText(m.payableNote), {
    x: PAGE.marginX + 12,
    y: cy - 13,
    size: 9,
    font: l.fonts.oblique,
    color: COLORS.slate700,
  })
  l.y = cy - calloutH - 6

  renderCommentsBlock(l, mode, {
    label: 'CUSTOMER COMMENTS ON PAYMENT TERMS, IF ANY',
    fieldName: 'paymentTerms.comments',
    tooltip: 'Customer comments on Payment Terms, if any.',
    comments: m.paymentTermsComments,
  })
}

/**
 * Optional customer-review comment area, reused for Payment Terms and Terms &
 * Conditions.
 *
 * - Fillable PDF: an editable multiline AcroForm text field is always drawn so
 *   the customer can add comments during review. NOT a native sticky-note or
 *   annotation — a plain multiline field, which is reliable across PDF viewers
 *   and e-sign tools. Font size is set explicitly (matching the body text) so
 *   the value never renders oversized.
 * - Final / Draft: rendered as static plain text ONLY when comments exist, so a
 *   customer-facing document never shows an empty review box.
 */
function renderCommentsBlock(
  l: Layout,
  mode: Mode,
  opts: { label: string; fieldName: string; tooltip: string; comments: string },
) {
  const fillable = mode === 'fillable'
  const { label, fieldName, tooltip, comments } = opts
  if (!fillable && !comments) return

  if (fillable) {
    const boxH = 46
    // Keep label + box together; only break to a new page when it genuinely
    // doesn't fit below the current content (tight cushion, not the generous
    // section-level one), so the box sits under the last clause whenever it can.
    const needed = 14 + boxH + 8
    if (l.y - needed < PAGE.marginBottom + 4) newPage(l)
    l.page.drawText(label, {
      x: PAGE.marginX,
      y: l.y - 9,
      size: 6.5,
      font: l.fonts.bold,
      color: COLORS.slate500,
    })
    const boxTop = l.y - 14
    drawRoundedRect(l.page, {
      x: PAGE.marginX,
      y: boxTop - boxH,
      width: CONTENT_W,
      height: boxH,
      radius: 4,
      color: COLORS.white,
      borderColor: COLORS.tealSoft,
      borderWidth: 0.8,
    })
    const form = l.doc.getForm()
    const tf = form.createTextField(fieldName)
    tf.enableMultiline()
    if (comments) tf.setText(sanitizeText(comments))
    tf.addToPage(l.page, {
      x: PAGE.marginX + 2,
      y: boxTop - boxH + 1,
      width: CONTENT_W - 4,
      height: boxH - 2,
      borderWidth: 0,
    })
    tf.setFontSize(9) // after addToPage — the /DA exists by then
    setFieldTooltip(tf, tooltip)
    l.y = boxTop - boxH - 8
    return
  }

  // Static (Final / Draft) — comments guaranteed non-empty here.
  const bodyLines = wrapText(comments, l.fonts.regular, 8.75, CONTENT_W - 4)
  // Keep the label + all comment lines together; break only if they don't fit
  // below the last clause (tight cushion), never split label from body.
  const needed = 14 + bodyLines.length * 12 + 6
  if (l.y - needed < PAGE.marginBottom + 4) newPage(l)
  l.page.drawText(label, {
    x: PAGE.marginX,
    y: l.y - 9,
    size: 6.5,
    font: l.fonts.bold,
    color: COLORS.slate500,
  })
  l.y -= 14
  bodyLines.forEach((ln) => {
    l.page.drawText(ln, {
      x: PAGE.marginX,
      y: l.y - 9,
      size: 8.75,
      font: l.fonts.regular,
      color: COLORS.slate700,
    })
    l.y -= 12
  })
  l.y -= 6
}

// Terms typesetting rhythm (points). Tuned for comfortable legal reading
// without wasting pages: a clear gap before each clause heading, a small gap
// under the heading, a visible paragraph-to-paragraph gap, and a slightly
// larger clause-to-clause gap.
const TERMS_TITLE_SIZE = 10
const TERMS_BODY_SIZE = 9
const TERMS_BODY_LEADING = 13.5 // ~1.5× — comfortable for legal copy
const TERMS_AFTER_TITLE = 4 // heading → first paragraph
const TERMS_PARA_GAP = 5 // paragraph → paragraph within a clause
const TERMS_CLAUSE_GAP = 10 // clause → clause (> paragraph gap)

function renderTerms(l: Layout, terms: TermClause[]) {
  drawSectionHeading(l, '06', 'Terms & Conditions')

  let lastPageIndex = l.pages.length - 1
  terms.forEach((t, ci) => {
    if (ci > 0) l.y -= TERMS_CLAUSE_GAP
    // Orphan control: reserve the heading + its gap + the first two body lines
    // so a clause heading never sits alone at the bottom of a page (it always
    // pulls at least the start of its first paragraph onto the same page).
    keepTogether(l, TERMS_TITLE_SIZE + TERMS_AFTER_TITLE + TERMS_BODY_LEADING * 2 + 6)
    if (l.pages.length - 1 !== lastPageIndex) {
      drawSectionHeading(l, '06', 'Terms & Conditions', true)
      lastPageIndex = l.pages.length - 1
    }
    drawWrappedText(l, t.title, {
      weight: 'bold',
      size: TERMS_TITLE_SIZE,
      leading: TERMS_TITLE_SIZE * 1.35,
      color: COLORS.slate950,
    })
    l.y -= TERMS_AFTER_TITLE
    t.paragraphs.forEach((p, pi) => {
      if (pi > 0) l.y -= TERMS_PARA_GAP
      const prev = l.pages.length - 1
      drawWrappedText(l, p, {
        size: TERMS_BODY_SIZE,
        leading: TERMS_BODY_LEADING,
        color: COLORS.slate700,
      })
      if (l.pages.length - 1 !== prev) lastPageIndex = l.pages.length - 1
    })
  })
  // Small breathing room before whatever follows (e.g. the T&C comments block).
  l.y -= 6
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

  // Purchase Order placement. Two paths, decided by remaining space:
  //  (a) it fits under the signatures → render it inline + a closing rule, so
  //      Execution and PO read as one finished page.
  //  (b) it would spill / strand on a near-empty page → give it a deliberate
  //      "Acceptance & Purchase Order" page with a deal summary, so the last
  //      page never looks like an accidental orphan.
  const inlineNeeds = 34 + 52 + 46 // heading + PO fields + closing mark
  if (l.y - inlineNeeds >= PAGE.marginBottom + 20) {
    drawSectionHeading(l, '08', 'Purchase Order')
    drawPurchaseOrderFields(l, data, m, mode, { leftX: PAGE.marginX, width: CONTENT_W })
    drawClosingMark(l)
  } else {
    drawAcceptancePage(l, data, m, mode)
  }
}

/**
 * Dedicated final page used when the Purchase Order can't sit cleanly under
 * the signatures. Title + at-a-glance deal summary + framed PO card + closing
 * rule, so a forced page break reads as intentional rather than empty.
 */
function drawAcceptancePage(l: Layout, data: OrderFormData, m: DocModel, mode: Mode) {
  newPage(l)
  l.y -= 6

  // Page title (no numbered circle — this is a summary page, not section 08).
  l.page.drawText('Acceptance & Purchase Order', {
    x: PAGE.marginX,
    y: l.y - 20,
    size: 20,
    font: l.fonts.display,
    color: COLORS.slate950,
  })
  l.y -= 30
  l.page.drawLine({
    start: { x: PAGE.marginX, y: l.y },
    end: { x: PAGE.width - PAGE.marginX, y: l.y },
    color: COLORS.slate200,
    thickness: 0.7,
  })
  l.y -= 16

  // Commercial summary card — the at-a-glance deal snapshot.
  drawCommercialSummary(l, m)
  l.y -= 20

  // Framed PO card.
  drawSectionHeading(l, '08', 'Purchase Order')
  const cardTop = l.y
  const cardH = 74
  drawRoundedRect(l.page, {
    x: PAGE.marginX,
    y: cardTop - cardH,
    width: CONTENT_W,
    height: cardH,
    radius: 8,
    color: COLORS.slate50,
    borderColor: COLORS.slate200,
    borderWidth: 0.8,
  })
  l.y = cardTop - 16
  drawPurchaseOrderFields(l, data, m, mode, {
    leftX: PAGE.marginX + 18,
    width: CONTENT_W - 36,
  })
  l.y = cardTop - cardH - 4
  drawClosingMark(l)
}

/**
 * Compact "Commercial Summary" card: customer on top, then a 3×2 grid of the
 * key commercial terms with the Total emphasised in brand teal. Gives the
 * acceptance page a deliberate, procurement-friendly snapshot.
 */
function drawCommercialSummary(l: Layout, m: DocModel) {
  const top = l.y
  const pad = 16
  const cardH = 132
  const page = l.page

  drawRoundedRect(page, {
    x: PAGE.marginX,
    y: top - cardH,
    width: CONTENT_W,
    height: cardH,
    radius: 8,
    color: COLORS.slate50,
    borderColor: COLORS.slate200,
    borderWidth: 0.8,
  })

  const left = PAGE.marginX + pad
  page.drawText('COMMERCIAL SUMMARY', {
    x: left,
    y: top - 16,
    size: 7,
    font: l.fonts.bold,
    color: COLORS.tealDeep,
  })
  page.drawLine({
    start: { x: left, y: top - 22 },
    end: { x: PAGE.width - PAGE.marginX - pad, y: top - 22 },
    color: COLORS.slate200,
    thickness: 0.6,
  })

  // Customer (full width).
  page.drawText('CUSTOMER', {
    x: left,
    y: top - 36,
    size: 6.5,
    font: l.fonts.bold,
    color: COLORS.slate500,
  })
  page.drawText(
    truncate(sanitizeText(m.customer.legalName || '—'), l.fonts.medium, 11, CONTENT_W - pad * 2),
    { x: left, y: top - 50, size: 11, font: l.fonts.medium, color: COLORS.slate950 },
  )

  // 3×2 grid of terms.
  const gap = 14
  const colW = (CONTENT_W - pad * 2 - gap * 2) / 3
  const cells: Array<{ label: string; value: string; emphasize?: boolean }> = [
    { label: 'TOTAL', value: m.totalLabel, emphasize: true },
    { label: 'CURRENCY', value: m.currencyCode },
    { label: 'BILLING PERIOD', value: m.subscription.billingPeriod },
    {
      label: 'SUBSCRIPTION TERM',
      value: m.subscription.termMonths ? `${m.subscription.termMonths} months` : '—',
    },
    { label: 'START DATE', value: m.subscription.startDate || '—' },
    { label: 'VALID THROUGH', value: m.customer.pricingValidThrough || '—' },
  ]
  const rowTops = [top - 70, top - 104]
  cells.forEach((c, i) => {
    const col = i % 3
    const rowTop = rowTops[Math.floor(i / 3)]
    const x = left + col * (colW + gap)
    page.drawText(c.label, {
      x,
      y: rowTop,
      size: 6,
      font: l.fonts.bold,
      color: COLORS.slate500,
    })
    const size = c.emphasize ? 13 : 10.5
    page.drawText(truncate(sanitizeText(c.value), l.fonts.display, size, colW), {
      x,
      y: rowTop - 15,
      size,
      font: l.fonts.display,
      color: c.emphasize ? COLORS.tealDeep : COLORS.slate950,
    })
  })

  l.y = top - cardH
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
    const sigText = sanitizeText(signature.signatureName || '')
    sigField.setText(sigText)
    // A short field sitting just above the baseline rule — reads like a signed
    // line, not a giant input box.
    sigField.addToPage(page, {
      x: x + 14,
      y: sigBaseY + 3,
      width: width - 28,
      height: 20,
      borderWidth: 0,
    })
    // Explicit, name-length-aware font size — set AFTER addToPage, which creates
    // the field's /DA entry (setFontSize needs it). Without this the field
    // auto-sizes to fill its height, rendering the signature comically large.
    // Clamp to a restrained range and shrink long names to fit the box; the
    // final updateFieldAppearances() re-renders the appearance at this size.
    let sigSize = 14
    const sigMaxW = width - 40
    while (sigSize > 10 && l.fonts.regular.widthOfTextAtSize(sigText || 'X', sigSize) > sigMaxW) {
      sigSize -= 0.5
    }
    sigField.setFontSize(sigSize)
    setFieldTooltip(sigField, 'Customer signature')
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
  const rows: Array<{ label: string; value: string; fieldName?: string; tooltip?: string }> = [
    {
      label: 'NAME',
      value: signature.name,
      fieldName: fillable && fieldPrefix ? `${fieldPrefix}.name` : undefined,
      tooltip: 'Full name of the signatory',
    },
    {
      label: 'DESIGNATION',
      value: signature.designation,
      fieldName: fillable && fieldPrefix ? `${fieldPrefix}.designation` : undefined,
      tooltip: 'Job title / designation of the signatory',
    },
    {
      // Semantic field name `signDate` (not the ambiguous `date`).
      label: 'DATE',
      value: formatDate(signature.date),
      fieldName: fillable && fieldPrefix ? `${fieldPrefix}.signDate` : undefined,
      tooltip: 'Customer signature date (dd/mm/yyyy)',
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
      if (r.tooltip) setFieldTooltip(tf, r.tooltip)
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

function drawPurchaseOrderFields(
  l: Layout,
  data: OrderFormData,
  m: DocModel,
  mode: Mode,
  bounds: { leftX: number; width: number },
) {
  const startY = l.y
  const page = l.page
  const rowH = 44
  const { leftX, width } = bounds
  const colW = (width - 24) / 3
  const columns = [
    { label: 'PO REQUIRED', x: leftX, w: colW },
    { label: 'PO NUMBER', x: leftX + colW + 12, w: colW },
    { label: m.po.amountHeading.toUpperCase(), x: leftX + (colW + 12) * 2, w: colW },
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
    setFieldTooltip(radio, 'Is a purchase order required?')
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
    setFieldTooltip(num, 'Purchase order number')

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
    setFieldTooltip(amt, 'Purchase order amount')
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
