import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const publicDir = resolve(process.cwd(), 'public')
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (url.startsWith('/')) {
    const p = join(publicDir, url.replace(/^\//, ''))
    if (!existsSync(p)) return new Response('missing', { status: 404 })
    return new Response(new Uint8Array(readFileSync(p)))
  }
  return originalFetch(input as any)
}) as typeof fetch

const { defaultData } = await import('../src/state/types')
const { generateDocx } = await import('../src/pdf/docx')

const d = defaultData()
d.customer.legalName = 'Acme Corp'
d.customer.preparedBy = 'Sujith Balakrishnan'
d.customer.orderFormDate = '2026-07-06'
d.customer.pricingValidThrough = '2026-08-06'
d.soldTo = { name: 'Jane Doe', email: 'jane@acme.com' }
d.services[0] = { id: 'a', description: 'Enterprise Plan', price: '1200', quantity: '12', unit: 'seats' }
d.billing.billTo = { name: 'AP', address: '123 Main St\nSF, CA' }
d.billing.sameAsBillTo = true
d.subscription.startDate = '2026-08-01'
d.purchaseOrder = { required: 'Yes', number: 'PO-1', amount: '14400' }
d.signature.customer.name = 'Jane Doe'
d.signature.customer.signatureName = 'Jane Doe'
d.signature.customer.designation = 'Head of RevOps'

const bytes = await generateDocx(d)
writeFileSync('/tmp/quill.docx', bytes)
console.log('docx bytes:', bytes.length)
