/**
 * Export-QA fixtures: named, deterministic order-form scenarios used to
 * exercise the QA engine and the document generators (see
 * `scripts/verify-qa.mts`). Not shipped to the browser bundle — this is dev
 * tooling. Keep each fixture minimal and focused on the thing it's testing.
 */
import { defaultData, type OrderFormData } from '@/state/types'
import type { CurrencyCode } from '@/lib/currency'

/** A fully valid, clean USD deal — the "everything is right" baseline. */
function base(): OrderFormData {
  const d = defaultData()
  d.currency = 'USD'
  d.customer.legalName = 'Acme Corporation, Inc.'
  d.customer.orderFormDate = '2026-07-06'
  d.customer.pricingValidThrough = '2027-01-06'
  d.customer.preparedBy = 'Sujith Balakrishnan'
  d.soldTo = { name: 'Jane Doe', email: 'jane.doe@acme.com' }
  d.services = [
    { id: 'a', description: 'SurveySparrow NPS Software License – Enterprise', price: '1200', quantity: '12' },
    { id: 'b', description: 'Text & Sentiment Analysis Add-on', price: '300', quantity: '12' },
    { id: 'c', description: 'Premium Support Package', price: '1500', quantity: '1' },
  ]
  d.billing.billTo = {
    name: 'Accounts Payable',
    address: '123 Main Street\nSan Francisco, CA 94103\nUnited States',
  }
  d.billing.sameAsBillTo = true
  d.subscription.startDate = '2026-08-01'
  d.signature.customer.name = 'Jane Doe'
  d.signature.customer.designation = 'Head of Revenue Operations'
  d.signature.customer.signatureName = 'Jane Doe'
  d.signature.customer.date = '2026-07-07'
  d.signature.surveysparrow.signatureName = 'Trent Ward'
  d.signature.surveysparrow.date = '2026-07-07'
  d.purchaseOrder = { required: 'No', number: '', amount: '' }
  return d
}

function withCurrency(code: CurrencyCode): OrderFormData {
  const d = base()
  d.currency = code
  return d
}

// A 1×1 transparent PNG — stands in for an uploaded asset in fixtures.
const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC'

export type Fixture = {
  name: string
  description: string
  data: OrderFormData
}

export const FIXTURES: Fixture[] = [
  { name: 'usd-normal', description: 'Normal USD deal, complete and clean.', data: base() },
  { name: 'eur-deal', description: 'EUR currency deal.', data: withCurrency('EUR') },
  { name: 'gbp-deal', description: 'GBP currency deal.', data: withCurrency('GBP') },
  { name: 'inr-deal', description: 'INR currency deal (₹ → “Rs” sanitisation).', data: withCurrency('INR') },
  {
    name: 'long-customer-name',
    description: 'Very long customer legal name (header/summary fit).',
    data: (() => {
      const d = base()
      d.customer.legalName =
        'Fontainebleau Global Hospitality & Experience Management Holdings International, Incorporated'
      return d
    })(),
  },
  {
    name: 'long-line-items',
    description: 'Very long line-item descriptions (overflow warning + truncation).',
    data: (() => {
      const d = base()
      d.services[0].description =
        'SurveySparrow Enterprise NPS, CSAT and CES Software License with Text & Sentiment Analysis, Custom Dashboards, and 24×7 Premium Support — Multi-region Deployment'
      return d
    })(),
  },
  {
    name: 'no-logo',
    description: 'No customer logo (should read as an OK optional).',
    data: base(),
  },
  {
    name: 'logo-mismatch',
    description: 'Logo filename that does not match the customer name (warning).',
    data: (() => {
      const d = base()
      d.customerLogo = {
        dataUrl: TINY_PNG,
        mime: 'image/png',
        width: 200,
        height: 80,
        filename: 'Fontainebleau_Logo_final.png',
      }
      return d
    })(),
  },
  {
    name: 'po-required',
    description: 'PO required with number + amount supplied.',
    data: (() => {
      const d = base()
      d.purchaseOrder = { required: 'Yes', number: 'PO-2026-00123', amount: '19500' }
      return d
    })(),
  },
  {
    name: 'po-required-missing',
    description: 'PO required but number/amount missing (errors).',
    data: (() => {
      const d = base()
      d.purchaseOrder = { required: 'Yes', number: '', amount: '' }
      return d
    })(),
  },
  { name: 'po-not-required', description: 'PO explicitly not required.', data: base() },
  {
    name: 'net-45',
    description: 'Net 45 payment term — callout and Payment Terms clause 3 both read 45.',
    data: (() => {
      const d = base()
      d.subscription.paymentTermDays = 45
      return d
    })(),
  },
  {
    name: 'modified-terms',
    description:
      'Manually overridden legal clause — surfaces the terms.modified warning; the edited text renders in exports (no "modified" marker in customer output).',
    data: (() => {
      const d = base()
      d.termOverrides = {
        confidentiality: [
          'Each party shall hold the other party’s Confidential Information in strict confidence for a period of five (5) years from the date of disclosure, as specifically negotiated for this Order Form.',
        ],
      }
      return d
    })(),
  },
  {
    name: 'uploaded-signature',
    description: 'Customer uses an uploaded signature image.',
    data: (() => {
      const d = base()
      d.signature.customer.type = 'image'
      d.signature.customer.image = {
        dataUrl: TINY_PNG,
        mime: 'image/png',
        width: 600,
        height: 200,
        filename: 'jane-doe-signature.png',
      }
      d.signature.customer.signatureName = ''
      return d
    })(),
  },
  { name: 'typed-signature', description: 'Typed signature only.', data: base() },
  {
    name: 'many-lines',
    description: 'Many service lines — pushes PO onto the Acceptance page.',
    data: (() => {
      const d = base()
      d.services = Array.from({ length: 12 }, (_, i) => ({
        id: `line-${i}`,
        description: `SurveySparrow module line item number ${i + 1}`,
        price: '500',
        quantity: '3',
      }))
      d.purchaseOrder = { required: 'Yes', number: 'PO-2026-00999', amount: '18000' }
      return d
    })(),
  },
  {
    name: 'expired-pricing',
    description: 'Pricing valid-through date in the past (warning).',
    data: (() => {
      const d = base()
      d.customer.pricingValidThrough = '2020-01-01'
      return d
    })(),
  },
  {
    name: 'empty-draft',
    description: 'A near-empty form (many errors, low score).',
    data: defaultData(),
  },
]
