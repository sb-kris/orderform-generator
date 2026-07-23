/**
 * Draft migration — the single place that turns a partial/older `OrderFormData`
 * blob (from localStorage or an imported `.quill.json` file) into a complete,
 * current-shape `OrderFormData`. Every field is defaulted from `defaultData()`,
 * so drafts saved by older versions load without crashing and pick up new
 * fields (unit, payment-term mode/custom, review comments, …) as blanks.
 */
import { defaultData, emptyLine, type OrderFormData, type ServiceLine } from './types'

export function migrateOrderFormData(parsed: Partial<OrderFormData>): OrderFormData {
  const base = defaultData()
  return {
    ...base,
    ...parsed,
    documentId: parsed.documentId ?? base.documentId,
    currency: parsed.currency ?? base.currency,
    customer: { ...base.customer, ...parsed.customer },
    soldTo: { ...base.soldTo, ...parsed.soldTo },
    services:
      parsed.services && parsed.services.length
        ? parsed.services.map((s: ServiceLine) => ({
            id: s.id ?? crypto.randomUUID(),
            description: s.description ?? '',
            price: s.price ?? '',
            quantity: s.quantity ?? '',
            unit: s.unit ?? '', // backward-compat: drafts predating the unit field
          }))
        : Array.from({ length: 6 }, emptyLine),
    billing: {
      ...base.billing,
      ...parsed.billing,
      billTo: { ...base.billing.billTo, ...parsed.billing?.billTo },
      shipTo: { ...base.billing.shipTo, ...parsed.billing?.shipTo },
    },
    subscription: { ...base.subscription, ...parsed.subscription },
    // Renamed from paymentTermsComments — migrate old drafts/exports forward.
    subscriptionComments:
      parsed.subscriptionComments ??
      (parsed as { paymentTermsComments?: string }).paymentTermsComments ??
      base.subscriptionComments,
    termsComments: parsed.termsComments ?? base.termsComments,
    customerLogo: parsed.customerLogo ?? base.customerLogo,
    ignoredWarnings: parsed.ignoredWarnings ?? base.ignoredWarnings,
    termOverrides: parsed.termOverrides ?? base.termOverrides,
    signature: {
      customer: { ...base.signature.customer, ...parsed.signature?.customer },
      surveysparrow: {
        ...base.signature.surveysparrow,
        ...parsed.signature?.surveysparrow,
      },
    },
    purchaseOrder: { ...base.purchaseOrder, ...parsed.purchaseOrder },
  }
}
