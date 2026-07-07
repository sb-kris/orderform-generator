/**
 * Word DOCX export. Builds the same section shape as the PDF from the shared
 * `buildDocModel`, so totals/currency/dates can never drift between outputs.
 *
 * Browser note: `Packer.toBuffer` requires Node's `Buffer` and throws in the
 * browser — this module uses `Packer.toBlob`, which works in both browser
 * and Node (Node ≥18 has Blob).
 *
 * Fillable form widgets aren't a native DOCX concept – the customer
 * signature block renders as labelled blank lines instead. Uploaded
 * signature images are embedded when available. Typed signatures render in
 * an italic script-ish style using "Brush Script MT" with an italic serif
 * fallback (font availability depends on the reader's machine; Word ships
 * Brush Script MT, Google Docs falls back to italic).
 */
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { OrderFormData, Signature } from '@/state/types'
import { buildDocModel, type DocModel } from '@/lib/docModel'
import { formatDate } from '@/lib/format'
import { buildTerms, type TermClause } from '@/lib/terms'

const TEAL = '3CA6B3'
const TEAL_DEEP = '0FA3B5'
const SLATE_950 = '0F172A'
const SLATE_700 = '475569'
const SLATE_500 = '94A3B8'
const SLATE_200 = 'E2E8F0'
const TEAL_WASH = 'E6F3F4'
const SLATE_WASH = 'F1F5F9'

type EmbeddedImage = { bytes: Uint8Array; kind: 'png' | 'jpg'; width: number; height: number }

export async function generateDocx(data: OrderFormData): Promise<Uint8Array> {
  const m = buildDocModel(data)

  const ssLogo = await fetchImage('/surveysparrow-logo.png', 5.797) // 800×138 px
  // No decorative banner/background image in the DOCX: Word/Google Docs render
  // positioned images unreliably, and the DOCX is optimised for editing and
  // legal redlining, not for mirroring the PDF's cover art. A clean header
  // table (logo + CONFIDENTIAL + Doc ID) carries the branding instead.
  const customerLogo = decodeAsset(data.customerLogo?.dataUrl, data.customerLogo?.width, data.customerLogo?.height)
  const customerSig =
    data.signature.customer.type === 'image'
      ? decodeAsset(
          data.signature.customer.image?.dataUrl,
          data.signature.customer.image?.width,
          data.signature.customer.image?.height,
        )
      : null
  const ssSig =
    data.signature.surveysparrow.type === 'image'
      ? decodeAsset(
          data.signature.surveysparrow.image?.dataUrl,
          data.signature.surveysparrow.image?.width,
          data.signature.surveysparrow.image?.height,
        )
      : null

  const customerName = m.customer.legalName || 'Draft'
  const doc = new Document({
    creator: 'SurveySparrow',
    title: `Service Order Form - ${customerName}`,
    subject: 'Service Order Form',
    description: `SurveySparrow Service Order Form for ${customerName} · Doc ID ${m.documentId}`,
    keywords: `SurveySparrow, Order Form, ${customerName}, ${m.documentId}`,
    lastModifiedBy: 'SurveySparrow',
    styles: {
      default: {
        document: {
          // DM Sans for brand consistency; readers without it get Word's
          // automatic sans-serif substitution (never a serif fallback).
          run: { font: 'DM Sans', size: 20, color: SLATE_950 },
          paragraph: { spacing: { line: 264, lineRule: 'auto' } },
        },
      },
    },
    sections: [
      {
        properties: {},
        footers: {
          // No PAGE/NUMPAGES fields: those render as a blank "Page  of " in
          // Google Docs and in Word until fields are manually refreshed, which
          // reads as broken. A static confidential line is reliable in every
          // viewer and still gives the document a finished footer.
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: `SurveySparrow Inc  ·  Order Form  ·  Confidential  ·  ${m.documentId}`,
                    size: 14,
                    color: SLATE_500,
                  }),
                ],
              }),
            ],
          }),
        },
        children: [
          buildHeaderTable(ssLogo, customerLogo, m),
          new Paragraph({ spacing: { after: 120 }, children: [] }),
          new Paragraph({
            children: [
              new TextRun({ text: 'SURVEYSPARROW INC', bold: true, size: 16, color: TEAL }),
            ],
          }),
          new Paragraph({
            spacing: { after: 120 },
            children: [
              new TextRun({ text: 'Service Order Form', bold: true, size: 52, color: SLATE_950 }),
            ],
          }),
          ...sectionHeading('01', 'Customer Information'),
          kvTable([
            [
              { label: "Customer's Legal Name", value: m.customer.legalName },
              { label: 'Order Form Date', value: m.customer.orderFormDate },
            ],
            [
              { label: 'Pricing Valid Through', value: m.customer.pricingValidThrough },
              { label: 'Prepared By', value: m.customer.preparedBy },
            ],
          ]),
          ...sectionHeading('02', 'Sold To'),
          kvTable([
            [
              { label: 'Name', value: m.soldTo.name },
              { label: 'Email', value: m.soldTo.email },
            ],
          ]),
          ...sectionHeading('03', 'Services'),
          servicesTable(m),
          ...sectionHeading('04', 'Billing & Shipping'),
          billingShippingTable(m),
          ...sectionHeading('05', 'Subscription Details'),
          kvTable([
            [
              { label: 'Billing Period', value: m.subscription.billingPeriod },
              { label: 'Subscription Term (Months)', value: m.subscription.termMonths || '—' },
            ],
            [
              { label: 'Start Date', value: m.subscription.startDate },
              { label: 'Payment Method', value: m.subscription.paymentMethod },
            ],
          ]),
          new Paragraph({
            spacing: { before: 100 },
            children: [
              new TextRun({
                text: m.payableNote,
                italics: true,
                size: 18,
                color: SLATE_700,
              }),
            ],
          }),
          ...sectionHeading('06', 'Terms & Conditions'),
          ...termsParagraphs(buildTerms(data.subscription.paymentTermDays ?? 30, data.termOverrides ?? {})),
          ...sectionHeading('07', 'Execution / Signature', true),
          new Paragraph({
            spacing: { after: 100 },
            children: [
              new TextRun({
                text: 'By signing below, each party agrees to the terms of this Order Form and represents that its signatory is authorised to bind it.',
                size: 17,
                color: SLATE_700,
              }),
            ],
          }),
          signatureTable(data.signature.customer, data.signature.surveysparrow, customerSig, ssSig, m),
          ...sectionHeading('08', 'Acceptance & Purchase Order'),
          commercialSummaryTable(m),
          new Paragraph({ spacing: { after: 120 }, children: [] }),
          purchaseOrderTable(m),
          closingMarker(),
        ],
      },
    ],
  })

  // Packer.toBlob works in both browser and Node (unlike toBuffer).
  const blob = await Packer.toBlob(doc)
  return new Uint8Array(await blob.arrayBuffer())
}

// ---- Assets -----------------------------------------------------------------

async function fetchImage(url: string, ratio: number): Promise<EmbeddedImage | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    const height = 26
    return { bytes, kind: 'png', width: Math.round(height * ratio), height }
  } catch {
    return null
  }
}

function decodeAsset(
  dataUrl: string | null | undefined,
  pxWidth?: number,
  pxHeight?: number,
): EmbeddedImage | null {
  if (!dataUrl) return null
  const m = /^data:image\/(png|jpeg|jpg);base64,(.+)$/.exec(dataUrl)
  if (!m) return null
  let raw: string
  try {
    raw = atob(m[2])
  } catch {
    // Corrupt base64 in a persisted draft — skip the image, keep the export.
    return null
  }
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i)
  const kind = m[1] === 'png' ? 'png' : 'jpg'
  // Fit inside 140×40 while preserving aspect ratio.
  const ratio = pxWidth && pxHeight ? pxWidth / pxHeight : 3
  let h = 40
  let w = h * ratio
  if (w > 140) {
    w = 140
    h = w / ratio
  }
  return { bytes, kind, width: Math.round(w), height: Math.round(h) }
}

function imageRun(img: EmbeddedImage): ImageRun {
  return new ImageRun({
    type: img.kind,
    data: img.bytes,
    transformation: { width: img.width, height: img.height },
  })
}

// ---- Building blocks ----------------------------------------------------------

function sectionHeading(num: string, title: string, breakBefore = false): Paragraph[] {
  return [
    new Paragraph({
      pageBreakBefore: breakBefore,
      spacing: { before: 280, after: 80 },
      // outlineLevel (NOT heading:/HeadingLevel) surfaces every section in
      // Word's Navigation pane + any generated TOC while preserving this
      // custom heading's look (teal number + bottom border) exactly.
      outlineLevel: 1,
      border: {
        bottom: { color: TEAL, style: BorderStyle.SINGLE, size: 10, space: 6 },
      },
      children: [
        new TextRun({ text: `${num}  `, bold: true, size: 22, color: TEAL_DEEP }),
        new TextRun({ text: title.toUpperCase(), bold: true, size: 22, color: SLATE_950 }),
      ],
    }),
  ]
}

type KV = { label: string; value: string }

const CELL_MARGINS = { top: 120, bottom: 120, left: 140, right: 140 }

// Letter page (12240 dxa) minus default 1in margins each side.
const USABLE_DXA = 9360

function kvTable(rows: KV[][]): Table {
  const cols = rows[0]?.length ?? 2
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: Array.from({ length: cols }, () => Math.floor(USABLE_DXA / cols)),
    borders: noTableBorders(),
    rows: rows.map(
      (row) =>
        new TableRow({
          children: row.map(
            (cell) =>
              new TableCell({
                width: { size: 100 / row.length, type: WidthType.PERCENTAGE },
                margins: CELL_MARGINS,
                children: [
                  new Paragraph({
                    spacing: { after: 40 },
                    children: [
                      new TextRun({
                        text: cell.label.toUpperCase(),
                        bold: true,
                        size: 13,
                        color: SLATE_500,
                      }),
                    ],
                  }),
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: cell.value || '—',
                        bold: !!cell.value,
                        size: 20,
                        color: cell.value ? SLATE_950 : SLATE_500,
                      }),
                    ],
                  }),
                ],
              }),
          ),
        }),
    ),
  })
}

function servicesTable(m: DocModel): Table {
  const header = new TableRow({
    tableHeader: true,
    children: ['Line Item', 'Price', 'Quantity', 'Sub-Total'].map(
      (label, i) =>
        new TableCell({
          shading: { fill: SLATE_WASH },
          margins: CELL_MARGINS,
          children: [
            new Paragraph({
              alignment:
                i === 0
                  ? AlignmentType.LEFT
                  : i === 2
                    ? AlignmentType.CENTER
                    : AlignmentType.RIGHT,
              children: [
                new TextRun({ text: label.toUpperCase(), bold: true, size: 14, color: SLATE_950 }),
              ],
            }),
          ],
        }),
    ),
  })

  const bodyRows = m.services.length
    ? m.services.map(
        (r) =>
          new TableRow({
            children: [
              td(r.description || '—', AlignmentType.LEFT),
              td(r.priceLabel, AlignmentType.RIGHT),
              td(r.quantityLabel, AlignmentType.CENTER),
              td(r.subtotalLabel, AlignmentType.RIGHT),
            ],
          }),
      )
    : [
        new TableRow({
          children: [
            new TableCell({
              columnSpan: 4,
              margins: CELL_MARGINS,
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: 'Add a line item to include Services.',
                      italics: true,
                      color: SLATE_500,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ]

  const totalRow = new TableRow({
    children: [
      new TableCell({
        columnSpan: 3,
        shading: { fill: TEAL_WASH },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'TOTAL', bold: true, size: 16, color: SLATE_700 })],
          }),
        ],
      }),
      new TableCell({
        shading: { fill: TEAL_WASH },
        margins: CELL_MARGINS,
        children: [
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: m.totalLabel, bold: true, size: 22, color: SLATE_950 }),
            ],
          }),
        ],
      }),
    ],
  })

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [4680, 1560, 1400, 1720],
    borders: hRuleBorders(SLATE_200, 4),
    rows: [header, ...bodyRows, totalRow],
  })
}

function td(
  text: string,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType],
): TableCell {
  return new TableCell({
    margins: CELL_MARGINS,
    children: [
      new Paragraph({
        alignment,
        children: [new TextRun({ text: text || '', size: 20, color: SLATE_950 })],
      }),
    ],
  })
}

function billingShippingTable(m: DocModel): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [4680, 4680],
    borders: allBorders(SLATE_200, 4),
    rows: [
      new TableRow({
        children: [
          addressCell('BILL TO', m.billTo.name, m.billTo.address),
          addressCell('SHIP TO', m.shipTo.name, m.shipTo.address),
        ],
      }),
    ],
  })
}

function addressCell(label: string, name: string, address: string): TableCell {
  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 160, bottom: 160, left: 180, right: 180 },
    children: [
      new Paragraph({
        children: [new TextRun({ text: label, bold: true, size: 15, color: TEAL_DEEP })],
      }),
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: 'NAME', bold: true, size: 13, color: SLATE_500 })],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: name || '—',
            bold: !!name,
            size: 20,
            color: name ? SLATE_950 : SLATE_500,
          }),
        ],
      }),
      new Paragraph({
        spacing: { before: 100, after: 40 },
        children: [new TextRun({ text: 'ADDRESS', bold: true, size: 13, color: SLATE_500 })],
      }),
      ...(address ? address.split(/\n+/).filter(Boolean) : ['—']).map(
        (line) =>
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                bold: !!address,
                size: 20,
                color: address ? SLATE_950 : SLATE_500,
              }),
            ],
          }),
      ),
    ],
  })
}

function termsParagraphs(terms: TermClause[]): Paragraph[] {
  const out: Paragraph[] = []
  terms.forEach((t) => {
    out.push(
      new Paragraph({
        spacing: { before: 180, after: 60 },
        children: [new TextRun({ text: t.title, bold: true, size: 20, color: SLATE_950 })],
      }),
    )
    t.paragraphs.forEach((p) => {
      out.push(
        new Paragraph({
          spacing: { after: 60 },
          children: [new TextRun({ text: p, size: 18, color: SLATE_700 })],
        }),
      )
    })
  })
  return out
}

function signatureTable(
  customer: Signature,
  ss: Signature,
  customerSig: EmbeddedImage | null,
  ssSig: EmbeddedImage | null,
  m: DocModel,
): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [4680, 4680],
    borders: allBorders(SLATE_200, 4),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            shading: { fill: TEAL_WASH },
            margins: { top: 80, bottom: 80, left: 180, right: 180 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'CUSTOMER', bold: true, size: 15, color: TEAL_DEEP }),
                  new TextRun({
                    text: m.customer.legalName ? `   ${m.customer.legalName}` : '',
                    size: 14,
                    color: SLATE_700,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            shading: { fill: SLATE_WASH },
            margins: { top: 80, bottom: 80, left: 180, right: 180 },
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'SURVEYSPARROW INC.', bold: true, size: 15, color: SLATE_700 }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          signatureCell(customer, customerSig),
          signatureCell(ss, ssSig),
        ],
      }),
    ],
  })
}

function signatureCell(sig: Signature, image: EmbeddedImage | null): TableCell {
  const sigChildren = (() => {
    if (image && sig.type === 'image') {
      return new Paragraph({ children: [imageRun(image)] })
    }
    if (sig.signatureName && sig.type === 'typed') {
      return new Paragraph({
        children: [
          new TextRun({
            text: sig.signatureName,
            italics: true,
            size: 28,
            // Word ships Brush Script MT; Google Docs falls back to the
            // italic default. Kept legible – no decorative dingbat fonts.
            font: 'Brush Script MT',
            color: SLATE_950,
          }),
        ],
      })
    }
    return new Paragraph({ children: [new TextRun({ text: ' ', size: 34 })] })
  })()

  return new TableCell({
    width: { size: 50, type: WidthType.PERCENTAGE },
    margins: { top: 160, bottom: 160, left: 180, right: 180 },
    children: [
      new Paragraph({
        spacing: { after: 60 },
        children: [new TextRun({ text: 'SIGNATURE', bold: true, size: 13, color: SLATE_500 })],
      }),
      sigChildren,
      // Signing baseline with breathing room above it (space to sign) — the
      // `before` spacing gives the empty area height without extra paragraphs.
      new Paragraph({
        spacing: { before: sig.type === 'image' && image ? 40 : 160 },
        border: { bottom: { color: SLATE_500, style: BorderStyle.SINGLE, size: 6, space: 2 } },
        children: [],
      }),
      kvLine('NAME', sig.name),
      kvLine('DESIGNATION', sig.designation),
      kvLine('DATE', formatDate(sig.date)),
    ],
  })
}

function kvLine(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { before: 120, after: 20 },
    children: [
      new TextRun({ text: `${label}:  `, bold: true, size: 13, color: SLATE_500 }),
      new TextRun({
        text: value || '________________________',
        bold: !!value,
        size: 18,
        color: value ? SLATE_950 : SLATE_500,
      }),
    ],
  })
}

/**
 * Commercial Summary card — mirrors the PDF's `drawCommercialSummary` and the
 * preview's `.odoc-summary`: a bordered card with the customer on a full-width
 * row, then a 3×2 grid of key terms, Total emphasised (largest, TEAL_DEEP).
 * All values come straight from the doc model (no recomputation).
 */
function commercialSummaryTable(m: DocModel): Table {
  const term = m.subscription.termMonths ? `${m.subscription.termMonths} months` : '—'
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [3120, 3120, 3120],
    borders: allBorders(SLATE_200, 4),
    rows: [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 3,
            shading: { fill: TEAL_WASH },
            margins: CELL_MARGINS,
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: 'COMMERCIAL SUMMARY',
                    bold: true,
                    size: 15,
                    color: TEAL_DEEP,
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [summaryCell('Customer', m.customer.legalName || '—', { span: 3 })],
      }),
      new TableRow({
        children: [
          summaryCell('Total', m.totalLabel, { emphasize: true }),
          summaryCell('Currency', m.currencyCode),
          summaryCell('Billing Period', m.subscription.billingPeriod),
        ],
      }),
      new TableRow({
        children: [
          summaryCell('Subscription Term', term),
          summaryCell('Start Date', m.subscription.startDate || '—'),
          summaryCell('Valid Through', m.customer.pricingValidThrough || '—'),
        ],
      }),
    ],
  })
}

function summaryCell(
  label: string,
  value: string,
  opts: { span?: number; emphasize?: boolean } = {},
): TableCell {
  const empty = !value || value === '—'
  return new TableCell({
    columnSpan: opts.span,
    margins: CELL_MARGINS,
    children: [
      new Paragraph({
        spacing: { after: 40 },
        children: [
          new TextRun({ text: label.toUpperCase(), bold: true, size: 13, color: SLATE_500 }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: value || '—',
            bold: !empty,
            size: opts.emphasize ? 26 : 20,
            color: empty ? SLATE_500 : opts.emphasize ? TEAL_DEEP : SLATE_950,
          }),
        ],
      }),
    ],
  })
}

/** Centered, letter-spaced "END OF ORDER FORM" — mirrors the PDF's closing mark. */
function closingMarker(): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({
        text: 'END OF ORDER FORM',
        bold: true,
        size: 15,
        color: SLATE_500,
        characterSpacing: 60,
      }),
    ],
  })
}

function purchaseOrderTable(m: DocModel): Table {
  const cells: KV[] = [
    { label: 'PO Required', value: m.po.required },
    { label: 'PO Number', value: m.po.numberLabel },
    { label: m.po.amountHeading, value: m.po.amountLabel },
  ]
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [3120, 3120, 3120],
    borders: noTableBorders(),
    rows: [
      new TableRow({
        children: cells.map(
          (c) =>
            new TableCell({
              margins: { top: 140, bottom: 140, left: 160, right: 160 },
              children: [
                new Paragraph({
                  children: [
                    new TextRun({ text: c.label.toUpperCase(), bold: true, size: 13, color: SLATE_500 }),
                  ],
                }),
                new Paragraph({
                  children: [
                    new TextRun({
                      text: c.value,
                      bold: c.value !== '—',
                      size: 22,
                      color: c.value === '—' ? SLATE_500 : SLATE_950,
                    }),
                  ],
                }),
              ],
            }),
        ),
      }),
    ],
  })
}

function buildHeaderTable(
  ssLogo: EmbeddedImage | null,
  customerLogo: EmbeddedImage | null,
  m: DocModel,
): Table {
  const left: Paragraph = ssLogo
    ? new Paragraph({ children: [imageRun(ssLogo)] })
    : new Paragraph({
        children: [new TextRun({ text: 'SurveySparrow', bold: true, size: 28, color: SLATE_950 })],
      })
  const rightRuns: (TextRun | ImageRun)[] = [
    new TextRun({ text: 'CONFIDENTIAL', bold: true, size: 14, color: SLATE_700 }),
    new TextRun({ text: `   Doc ID ${m.documentId}`, size: 14, color: SLATE_500 }),
  ]
  const right = new Paragraph({ alignment: AlignmentType.RIGHT, children: rightRuns })
  const rows = [
    new TableRow({
      children: [
        new TableCell({ borders: noBorders(), children: [left] }),
        new TableCell({ borders: noBorders(), children: [right] }),
      ],
    }),
  ]
  if (customerLogo) {
    rows.push(
      new TableRow({
        children: [
          new TableCell({ borders: noBorders(), children: [new Paragraph({ children: [] })] }),
          new TableCell({
            borders: noBorders(),
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [imageRun(customerLogo)],
              }),
            ],
          }),
        ],
      }),
    )
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    columnWidths: [4680, 4680],
    borders: noTableBorders(),
    rows,
  })
}

function noTableBorders() {
  const b = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }
  return {
    top: b,
    bottom: b,
    left: b,
    right: b,
    insideHorizontal: b,
    insideVertical: b,
  }
}

function allBorders(color: string, size: number) {
  const b = { style: BorderStyle.SINGLE, size, color }
  return {
    top: b,
    bottom: b,
    left: b,
    right: b,
    insideHorizontal: b,
    insideVertical: b,
  }
}

/**
 * Horizontal rules only — no vertical grid lines. Reads as a designed
 * document table (like the PDF's Services table) rather than a spreadsheet.
 */
function hRuleBorders(color: string, size: number) {
  const b = { style: BorderStyle.SINGLE, size, color }
  const none = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }
  return {
    top: none,
    bottom: b,
    left: none,
    right: none,
    insideHorizontal: b,
    insideVertical: none,
  }
}

function noBorders() {
  const b = { style: BorderStyle.NIL, size: 0, color: 'FFFFFF' }
  return { top: b, bottom: b, left: b, right: b }
}
