// Verify PDF output end-to-end. Since assets.ts fetches Tenon fonts from
// `/fonts/*` at runtime (works in the browser), we shim `fetch` here to read
// them from `public/fonts/` on disk.
import { PDFDocument, PDFRadioGroup } from 'pdf-lib'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const publicDir = resolve(process.cwd(), 'public')

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (url.startsWith('/')) {
    const filepath = join(publicDir, url.replace(/^\//, ''))
    if (!existsSync(filepath))
      return new Response('missing', { status: 404, statusText: 'Not Found' })
    const buf = readFileSync(filepath)
    return new Response(new Uint8Array(buf), { status: 200 })
  }
  return originalFetch(input as any, init)
}) as typeof fetch

const { defaultData } = await import('../src/state/types')
const { generateFinalPdf } = await import('../src/pdf/finalPdf')
const { generateFillablePdf } = await import('../src/pdf/fillablePdf')

const data = defaultData()
data.currency = 'EUR'
data.customer.legalName = 'Acme Corporation, Inc.'
data.customer.orderFormDate = '2026-07-06'
data.customer.pricingValidThrough = '2026-08-06'
data.customer.preparedBy = 'Sujith Balakrishnan'
data.soldTo.name = 'Jane Doe'
data.soldTo.email = 'jane.doe@acme.com'
data.services[0] = {
  id: 'a',
  description: 'SurveySparrow NPS Software License – Enterprise Plan',
  price: '1200',
  quantity: '12',
}
data.services[1] = {
  id: 'b',
  description: 'Text and Sentiment Analysis Add-on',
  price: '300',
  quantity: '12',
}
data.services[2] = {
  id: 'c',
  description: 'Premium Support Package',
  price: '1500',
  quantity: '1',
}
data.billing.billTo.name = 'Accounts Payable'
data.billing.billTo.address = '123 Main Street\nSan Francisco, CA 94103\nUnited States'
data.billing.sameAsBillTo = true
data.subscription.startDate = '2026-08-01'
data.signature.customer.name = 'Jane Doe'
data.signature.customer.designation = 'Head of Revenue Operations'
// Customer uses an uploaded signature image (framing regression check).
const sigPath = process.env.QUILL_SIG_DATAURL
if (sigPath && existsSync(sigPath)) {
  data.signature.customer.type = 'image'
  data.signature.customer.image = {
    dataUrl: readFileSync(sigPath, 'utf8').trim(),
    mime: 'image/png',
    width: 600,
    height: 200,
  }
}
data.signature.surveysparrow.signatureName = 'Trent Ward'
data.signature.surveysparrow.date = '2026-07-07'
data.purchaseOrder.required = 'Yes'
data.purchaseOrder.number = 'PO-2026-00123'
data.purchaseOrder.amount = '19500'

const final = await generateFinalPdf(data)
const fillable = await generateFillablePdf(data)

// Regression: INR + PO required must not crash the fillable export
// (₹ is outside WinAnsi; field values are sanitized to "Rs ...").
// Also: >3-line addresses must render fully (adaptive card height).
const inrData = structuredClone(data)
inrData.currency = 'INR'
inrData.billing.billTo.address =
  'Acme Corp\n123 Main St\nSuite 400\nSan Francisco, CA 94105\nUnited States'
inrData.billing.sameAsBillTo = true
const inrFillable = await generateFillablePdf(inrData)
writeFileSync('/tmp/quill-fillable-inr.pdf', inrFillable)
console.log('INR fillable OK:', inrFillable.length, 'bytes')

writeFileSync('/tmp/quill-final.pdf', final)
writeFileSync('/tmp/quill-fillable.pdf', fillable)

const inspect = async (label: string, bytes: Uint8Array) => {
  const doc = await PDFDocument.load(bytes)
  const form = doc.getForm()
  const fields = form.getFields().map((f) => {
    if (f instanceof PDFRadioGroup) {
      return `Radio:${f.getName()}=${JSON.stringify(f.getOptions())} (selected=${f.getSelected()})`
    }
    return `${f.constructor.name}:${f.getName()}`
  })
  console.log(
    `[${label}] pages=${doc.getPageCount()} bytes=${bytes.length}\n  fields:\n    ${fields.join('\n    ') || 'none'}`,
  )
}
await inspect('final', final)
await inspect('fillable', fillable)
