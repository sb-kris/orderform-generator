import { PDFDocument, PDFName, PDFPage, PDFString, rgb, type RGB } from 'pdf-lib'
import {
  loadFonts,
  loadCoverBackground,
  loadPageBackground,
  type PdfFonts,
} from './assets'
import type { PDFField, PDFFont, PDFImage } from 'pdf-lib'

/** Best-effort AcroForm tooltip (/TU). Never let it abort an export. */
function setFieldTU(field: PDFField, text?: string) {
  if (!text) return
  try {
    field.acroField.dict.set(PDFName.of('TU'), PDFString.of(text))
  } catch {
    /* tooltip is a nice-to-have */
  }
}

/** US Letter, in points (1pt = 1/72"). */
export const PAGE = {
  width: 612,
  height: 792,
  marginX: 44,
  marginTop: 78,
  marginBottom: 54,
}
export const CONTENT_W = PAGE.width - PAGE.marginX * 2

/** SurveySparrow design tokens, converted to pdf-lib RGB. */
export const COLORS = {
  teal: rgb(60 / 255, 166 / 255, 179 / 255),
  tealBright: rgb(45 / 255, 212 / 255, 191 / 255),
  tealDeep: rgb(15 / 255, 163 / 255, 181 / 255),
  tealSoft: rgb(230 / 255, 243 / 255, 244 / 255),
  purple: rgb(98 / 255, 59 / 255, 236 / 255),
  purpleLight: rgb(134 / 255, 100 / 255, 255 / 255),
  purpleSoft: rgb(234 / 255, 233 / 255, 254 / 255),

  slate950: rgb(15 / 255, 23 / 255, 42 / 255),
  slate900: rgb(30 / 255, 41 / 255, 59 / 255),
  slate800: rgb(51 / 255, 65 / 255, 85 / 255),
  slate700: rgb(71 / 255, 85 / 255, 105 / 255),
  slate600: rgb(100 / 255, 116 / 255, 139 / 255),
  slate500: rgb(148 / 255, 163 / 255, 184 / 255),
  slate400: rgb(163 / 255, 174 / 255, 189 / 255),
  slate300: rgb(203 / 255, 213 / 255, 225 / 255),
  slate200: rgb(226 / 255, 232 / 255, 240 / 255),
  slate100: rgb(241 / 255, 245 / 255, 249 / 255),
  slate50: rgb(248 / 255, 250 / 255, 252 / 255),

  white: rgb(1, 1, 1),
  /** The teal accent bar baked into the brand background designs (bottom edge). */
  bar: rgb(12 / 255, 148 / 255, 136 / 255),
}

export type Layout = {
  doc: PDFDocument
  fonts: PdfFonts
  pages: PDFPage[]
  page: PDFPage
  y: number
  documentTitle: string
  documentId: string
  /** Brand design backgrounds (logo / Confidential pill / decor are baked in). */
  coverBg: PDFImage | null
  pageBg: PDFImage | null
  customerLogo: PDFImage | null
}

export async function createLayout(
  title: string,
  documentId: string,
  customerLogoBytes?: Uint8Array | null,
  customerLogoMime?: 'image/png' | 'image/jpeg' | null,
): Promise<Layout> {
  const doc = await PDFDocument.create()
  // NB: full metadata (incl. per-customer title + keywords) is set later in
  // setDocumentMetadata. These are neutral defaults — never the internal
  // "Quill" name, which must not appear in any customer-facing document.
  doc.setTitle(title)
  doc.setAuthor('SurveySparrow')
  doc.setSubject('Service Order Form')
  doc.setCreator('SurveySparrow')

  const fonts = await loadFonts(doc)
  const coverBg = await loadCoverBackground(doc)
  const pageBg = await loadPageBackground(doc)
  let customerLogo: PDFImage | null = null
  if (customerLogoBytes && customerLogoBytes.byteLength > 0) {
    try {
      customerLogo =
        customerLogoMime === 'image/jpeg'
          ? await doc.embedJpg(customerLogoBytes)
          : await doc.embedPng(customerLogoBytes)
    } catch {
      customerLogo = null
    }
  }
  const page = doc.addPage([PAGE.width, PAGE.height])
  const layout: Layout = {
    doc,
    fonts,
    pages: [page],
    page,
    y: PAGE.height - PAGE.marginTop,
    documentTitle: title,
    documentId,
    coverBg,
    pageBg,
    customerLogo,
  }
  drawPageChrome(layout, true) // page 1 = cover
  return layout
}

export function newPage(l: Layout) {
  const p = l.doc.addPage([PAGE.width, PAGE.height])
  l.pages.push(p)
  l.page = p
  l.y = PAGE.height - PAGE.marginTop
  drawPageChrome(l, false) // interior page
}

export function ensureSpace(l: Layout, needed: number) {
  if (l.y - needed < PAGE.marginBottom + 20) newPage(l)
}

export function keepTogether(l: Layout, needed: number) {
  if (l.y - needed < PAGE.marginBottom + 20) newPage(l)
}

// -------- Page chrome (brand design background + Doc ID) --------------------

/** Height (pt) of the teal accent bar baked into the design (14px of 2000). */
const BAR_H = (14 / 2000) * PAGE.height

/**
 * Lay the brand design background for a page and overlay the Doc ID. The
 * design images bake in the SurveySparrow logo, the Confidential pill and the
 * decorative outlines, so the renderer draws none of those itself.
 *
 * - Cover (page 1): green-banner design; Doc ID in white over the banner.
 * - Interior (pages 2+): white design; Doc ID in dark slate.
 *
 * Images are A4 aspect; the page is US Letter, so the image is scaled to the
 * page WIDTH and anchored to the TOP (keeping the banner/logo crisp and
 * undistorted). The white body fills the middle and the thin bottom accent bar
 * — cropped by that scaling — is redrawn at the page's bottom edge.
 */
function drawPageChrome(l: Layout, isCover: boolean) {
  const page = l.page
  const bg = isCover ? l.coverBg : l.pageBg
  if (bg) {
    const scale = PAGE.width / bg.width // fill width
    const h = bg.height * scale
    page.drawImage(bg, { x: 0, y: PAGE.height - h, width: PAGE.width, height: h })
  } else if (isCover) {
    // Fallback so the white Doc ID stays visible without the asset.
    page.drawRectangle({ x: 0, y: PAGE.height - 64, width: PAGE.width, height: 64, color: COLORS.tealDeep })
  }
  // Redraw the accent bar cropped off the bottom by the width-fit scaling.
  page.drawRectangle({ x: 0, y: 0, width: PAGE.width, height: BAR_H, color: COLORS.bar })
  drawDocId(l, isCover)
}

/**
 * Doc ID, right-aligned in the top band and vertically level with the baked
 * SurveySparrow logo. White over the cover banner, dark slate on the interior
 * pages. ("Confidential" lives in the footer, so the top-right carries only
 * the Doc ID.)
 */
function drawDocId(l: Layout, isCover: boolean) {
  const label = 'Doc ID'
  const id = l.documentId
  const idSize = 8
  const gap = 5
  const idW = l.fonts.bold.widthOfTextAtSize(id, idSize)
  const labelW = l.fonts.regular.widthOfTextAtSize(label, idSize)
  const startX = PAGE.width - PAGE.marginX - (labelW + gap + idW) // right-aligned
  // Baseline chosen so the text's visual middle lines up with the baked logo's
  // vertical centre (measured at PDF y ≈ 757 in the cover banner).
  const y = PAGE.height - 38
  const labelColor = isCover ? COLORS.white : COLORS.slate600
  const idColor = isCover ? COLORS.white : COLORS.slate950
  l.page.drawText(label, { x: startX, y, size: idSize, font: l.fonts.regular, color: labelColor })
  l.page.drawText(id, { x: startX + labelW + gap, y, size: idSize, font: l.fonts.bold, color: idColor })
}

// -------- Footer -------------------------------------------------------------

export function drawFooters(l: Layout) {
  const total = l.pages.length
  l.pages.forEach((page, i) => {
    const pageNum = i + 1
    const y = PAGE.marginBottom - 24
    page.drawLine({
      start: { x: PAGE.marginX, y: y + 14 },
      end: { x: PAGE.width - PAGE.marginX, y: y + 14 },
      color: COLORS.slate200,
      thickness: 0.5,
    })
    page.drawText(
      `SurveySparrow Inc  ·  Order Form  ·  Confidential  ·  ${l.documentId}`,
      {
        x: PAGE.marginX,
        y,
        size: 7.5,
        font: l.fonts.regular,
        color: COLORS.slate500,
      },
    )
    const right = `Page ${pageNum} of ${total}`
    const rw = l.fonts.medium.widthOfTextAtSize(right, 7.5)
    page.drawText(right, {
      x: PAGE.width - PAGE.marginX - rw,
      y,
      size: 7.5,
      font: l.fonts.medium,
      color: COLORS.slate600,
    })
  })
}

// -------- Text ---------------------------------------------------------------

type TextOpts = {
  size?: number
  weight?: 'regular' | 'medium' | 'bold' | 'oblique' | 'display'
  color?: RGB
  x?: number
  maxWidth?: number
  leading?: number
  indent?: number
}

function pickFont(l: Layout, weight: TextOpts['weight']): PDFFont {
  switch (weight) {
    case 'medium':
      return l.fonts.medium
    case 'bold':
      return l.fonts.bold
    case 'oblique':
      return l.fonts.oblique
    case 'display':
      return l.fonts.display
    default:
      return l.fonts.regular
  }
}

/**
 * Keep text inside the character range every embedded font is guaranteed to
 * cover. DM Sans latin subsets cover Latin-1 plus € and £ (verified via
 * fontkit hasGlyphForCodePoint); ₹ is NOT in the subset, so INR amounts fall
 * back to the conventional "Rs" prefix. Smart quotes/dashes map to safe
 * equivalents so a stray character never crashes `drawText`.
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[–—]/g, '-')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, '...')
    .replace(/₹/g, 'Rs ')
    .replace(/[^\x00-\xFF€]/g, '')
}

export function drawWrappedText(l: Layout, text: string, opts: TextOpts = {}): number {
  const size = opts.size ?? 9.5
  const font = pickFont(l, opts.weight)
  const color = opts.color ?? COLORS.slate700
  const leading = opts.leading ?? size * 1.4
  const x = opts.x ?? PAGE.marginX + (opts.indent ?? 0)
  const maxWidth = opts.maxWidth ?? CONTENT_W - (opts.indent ?? 0)

  const safe = sanitizeText(text)

  let linesDrawn = 0
  const paragraphs = safe.split(/\n/)
  for (const para of paragraphs) {
    const words = para.split(/\s+/).filter(Boolean)
    let line = ''
    const flush = () => {
      ensureSpace(l, leading)
      l.page.drawText(line, { x, y: l.y - size, size, font, color })
      l.y -= leading
      linesDrawn++
      line = ''
    }
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
        if (line) {
          flush()
          line = w
        } else {
          ensureSpace(l, leading)
          l.page.drawText(w, { x, y: l.y - size, size, font, color })
          l.y -= leading
          linesDrawn++
          line = ''
        }
      } else {
        line = candidate
      }
    }
    if (line) flush()
    if (words.length === 0) l.y -= leading * 0.5
  }
  return linesDrawn
}

/** Numbered section header: teal circle + uppercase display title + rule. */
export function drawSectionHeading(
  l: Layout,
  num: string,
  title: string,
  continuation = false,
) {
  ensureSpace(l, 34)
  // Breathing room before each numbered section so sections don't crowd each
  // other. (Continuation headers land at the top of a fresh page, so the small
  // gap there just reads as top padding.)
  l.y -= 12
  const y = l.y
  const circleR = 10
  const cx = PAGE.marginX + circleR
  const cy = y - circleR
  l.page.drawCircle({ x: cx, y: cy, size: circleR, color: COLORS.teal })
  const numFont = l.fonts.bold
  const numSize = 9
  const numW = numFont.widthOfTextAtSize(num, numSize)
  l.page.drawText(num, {
    x: cx - numW / 2,
    y: cy - 3,
    size: numSize,
    font: numFont,
    color: COLORS.white,
  })
  const titleText = continuation
    ? `${title.toUpperCase()} (CONTINUED)`
    : title.toUpperCase()
  l.page.drawText(titleText, {
    x: cx + circleR + 10,
    y: cy - 3,
    size: 11,
    font: l.fonts.display,
    color: COLORS.slate950,
  })
  l.page.drawLine({
    start: { x: PAGE.marginX, y: cy - circleR - 4 },
    end: { x: PAGE.width - PAGE.marginX, y: cy - circleR - 4 },
    color: COLORS.slate200,
    thickness: 0.7,
  })
  l.y = cy - circleR - 14
}

type LabeledFieldSpec = {
  name: string
  kind: 'text' | 'dropdown'
  options?: string[]
  tooltip?: string
}

export function drawLabeledFields(
  l: Layout,
  entries: Array<{
    label: string
    value: string
    required?: boolean
    span?: 1 | 2
    /** Suppress the `{{Label}}` placeholder when blank (render an empty pill). */
    optional?: boolean
    /** When `fillable`, place this AcroForm field inside the pill instead of static text. */
    field?: LabeledFieldSpec
  }>,
  columns = 2,
  fillable = false,
) {
  const colGap = 16
  const colWidth = (CONTENT_W - colGap * (columns - 1)) / columns
  // 42pt rows: 9pt to the label baseline, 5pt clearance between the label
  // and the pill top, 22pt pill, 6pt row gap. Anything tighter reads as the
  // label "touching" the pill (the misalignment reported on pages 1–2).
  const rowHeight = 42
  const labelSize = 6.5
  const valueSize = 9.5

  let col = 0
  let rowY = l.y
  entries.forEach((e) => {
    const span = Math.min(e.span ?? 1, columns) as 1 | 2
    if (col + span > columns) {
      col = 0
      l.y = rowY - rowHeight
    }
    if (col === 0) {
      ensureSpace(l, rowHeight)
      rowY = l.y
    }
    const x = PAGE.marginX + col * (colWidth + colGap)
    const width = span === columns ? CONTENT_W : colWidth * span + colGap * (span - 1)

    const label = e.label.toUpperCase() + (e.required ? '  *' : '')
    l.page.drawText(label, {
      x,
      y: rowY - 9,
      size: labelSize,
      font: l.fonts.bold,
      color: COLORS.slate500,
    })

    const pillY = rowY - 36
    const pillH = 22
    const filled = !!e.value.trim()
    drawRoundedRect(l.page, {
      x,
      y: pillY,
      width,
      height: pillH,
      radius: 4,
      color: COLORS.white,
      borderColor: filled ? COLORS.slate200 : COLORS.tealSoft,
      borderWidth: 0.8,
    })
    if (fillable && e.field) {
      // Customer-editable AcroForm field placed inside the pill.
      const form = l.doc.getForm()
      const rect = { x: x + 2, y: pillY + 1, width: width - 4, height: pillH - 2, borderWidth: 0 }
      const v = e.value.trim()
      if (e.field.kind === 'dropdown') {
        const dd = form.createDropdown(e.field.name)
        dd.addOptions(e.field.options ?? [])
        if (v && (e.field.options ?? []).includes(v)) dd.select(v)
        dd.addToPage(l.page, rect)
        // Explicit font size AFTER addToPage (which creates the /DA entry). Without
        // this, pdf-lib auto-sizes the dropdown text to fill the widget height,
        // rendering the selected value comically large — match the other fields.
        dd.setFontSize(valueSize)
        setFieldTU(dd, e.field.tooltip)
      } else {
        const tf = form.createTextField(e.field.name)
        if (v) tf.setText(sanitizeText(v))
        tf.addToPage(l.page, rect)
        tf.setFontSize(valueSize) // after addToPage — the /DA exists by then
        setFieldTU(tf, e.field.tooltip)
      }
    } else {
      // Static text. Optional-but-blank fields render an empty pill (never the
      // `{{Label}}` placeholder), so review-stage PDFs stay customer-clean.
      const displayText = filled
        ? truncate(sanitizeText(e.value), l.fonts.medium, valueSize, width - 16)
        : e.optional
          ? ''
          : `{{${e.label.replace(/[^\w]+/g, '_')}}}`
      if (displayText) {
        l.page.drawText(displayText, {
          x: x + 10,
          y: pillY + 7,
          size: valueSize,
          font: filled ? l.fonts.medium : l.fonts.regular,
          color: filled ? COLORS.slate950 : COLORS.teal,
        })
      }
    }
    col += span
    if (col >= columns) {
      col = 0
      l.y = rowY - rowHeight
    }
  })
  if (col !== 0) l.y = rowY - rowHeight
}

/**
 * Measure-only line wrapper (same algorithm as drawWrappedText). Used to
 * size containers before drawing, e.g. the adaptive address cards.
 */
export function wrapText(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const out: string[] = []
  for (const para of sanitizeText(text).split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    let line = ''
    for (const w of words) {
      const candidate = line ? `${line} ${w}` : w
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        out.push(line)
        line = w
      } else if (font.widthOfTextAtSize(candidate, size) > maxWidth) {
        out.push(truncate(w, font, size, maxWidth))
        line = ''
      } else {
        line = candidate
      }
    }
    if (line) out.push(line)
  }
  return out
}

export function truncate(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  const ellipsis = '...'
  let clipped = text
  while (
    clipped.length > 1 &&
    font.widthOfTextAtSize(clipped + ellipsis, size) > maxWidth
  ) {
    clipped = clipped.slice(0, -1)
  }
  return clipped + ellipsis
}

/**
 * Rounded rectangle helper – pdf-lib doesn't ship one out of the box.
 *
 * Coordinate-system note: `page.drawSvgPath` interprets the path in SVG
 * space (y grows DOWNWARD from the anchor) and flips it via `scale(1,-1)`.
 * So the path is expressed in LOCAL y-down coordinates (0..width, 0..height)
 * and anchored at the rectangle's top-left corner in PDF coordinates
 * (`y + height`). Passing page-absolute PDF coordinates inside the path
 * string would render the shape mirrored off-page — invisibly.
 */
export function drawRoundedRect(
  page: PDFPage,
  opts: {
    x: number
    y: number // bottom edge, PDF coordinates (same convention as drawRectangle)
    width: number
    height: number
    radius: number
    color?: RGB
    borderColor?: RGB
    borderWidth?: number
    opacity?: number
  },
) {
  const {
    x,
    y,
    width,
    height,
    radius: r,
    color,
    borderColor,
    borderWidth = 0,
    opacity,
  } = opts
  const rr = Math.min(r, width / 2, height / 2)
  // Local path, y-down, origin at top-left of the rect.
  const d = [
    `M ${rr} 0`,
    `H ${width - rr}`,
    `Q ${width} 0 ${width} ${rr}`,
    `V ${height - rr}`,
    `Q ${width} ${height} ${width - rr} ${height}`,
    `H ${rr}`,
    `Q 0 ${height} 0 ${height - rr}`,
    `V ${rr}`,
    `Q 0 0 ${rr} 0`,
    'Z',
  ].join(' ')
  page.drawSvgPath(d, {
    x,
    y: y + height,
    color,
    borderColor,
    borderWidth,
    opacity,
  })
}
