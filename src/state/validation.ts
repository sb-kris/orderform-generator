import type { OrderFormData } from './types'
import { parseNumber } from '@/lib/format'

export type ValidationIssue = {
  path: string
  message: string
  sectionId: string
  severity: 'critical' | 'warning'
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const critical = (path: string, message: string, sectionId: string): ValidationIssue => ({
  path,
  message,
  sectionId,
  severity: 'critical',
})

/** Fields whose absence blocks the Final PDF download. */
export function criticalIssues(data: OrderFormData): ValidationIssue[] {
  return validate(data).filter((i) => i.severity === 'critical')
}

export function validate(data: OrderFormData): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const push = (i: ValidationIssue) => issues.push(i)

  // Customer
  if (!data.customer.legalName.trim())
    push(critical('customer.legalName', 'Customer legal name is required.', 'customer'))
  if (!data.customer.orderFormDate)
    push(critical('customer.orderFormDate', 'Order form date is required.', 'customer'))
  if (!data.customer.pricingValidThrough)
    push(
      critical(
        'customer.pricingValidThrough',
        'Pricing valid-through date is required.',
        'customer',
      ),
    )
  if (!data.customer.preparedBy.trim())
    push(critical('customer.preparedBy', 'Prepared By is required.', 'customer'))

  // Sold To
  if (!data.soldTo.name.trim())
    push(critical('soldTo.name', 'Sold To name is required.', 'soldTo'))
  if (!data.soldTo.email.trim())
    push(critical('soldTo.email', 'Sold To email is required.', 'soldTo'))
  else if (!EMAIL.test(data.soldTo.email))
    push(critical('soldTo.email', 'Sold To email is not a valid email address.', 'soldTo'))

  // Services – at least one populated line with all fields
  const populatedLines = data.services.filter(
    (l) => l.description.trim() || l.price || l.quantity,
  )
  if (populatedLines.length === 0)
    push(critical('services', 'Add at least one service line item.', 'services'))
  populatedLines.forEach((l, i) => {
    if (!l.description.trim())
      push(
        critical(
          `services.${i}.description`,
          `Line ${i + 1}: description is required.`,
          'services',
        ),
      )
    const p = parseNumber(l.price)
    if (!l.price || !Number.isFinite(p) || p < 0)
      push(
        critical(
          `services.${i}.price`,
          `Line ${i + 1}: price must be a non-negative number.`,
          'services',
        ),
      )
    const q = parseNumber(l.quantity)
    if (!l.quantity || !Number.isFinite(q) || q < 0)
      push(
        critical(
          `services.${i}.quantity`,
          `Line ${i + 1}: quantity must be a non-negative number.`,
          'services',
        ),
      )
  })

  // Billing / shipping
  if (!data.billing.billTo.name.trim())
    push(critical('billing.billTo.name', 'Bill To name is required.', 'billing'))
  if (!data.billing.billTo.address.trim())
    push(critical('billing.billTo.address', 'Bill To address is required.', 'billing'))
  if (!data.billing.sameAsBillTo) {
    if (!data.billing.shipTo.name.trim())
      push(critical('billing.shipTo.name', 'Ship To name is required.', 'billing'))
    if (!data.billing.shipTo.address.trim())
      push(critical('billing.shipTo.address', 'Ship To address is required.', 'billing'))
  }

  // Subscription
  const term = parseNumber(data.subscription.termMonths)
  if (!term || term <= 0)
    push(
      critical(
        'subscription.termMonths',
        'Subscription term must be a positive number of months.',
        'subscription',
      ),
    )
  if (!data.subscription.startDate)
    push(
      critical(
        'subscription.startDate',
        'Subscription start date is required.',
        'subscription',
      ),
    )

  // Purchase order
  if (data.purchaseOrder.required === 'Yes') {
    if (!data.purchaseOrder.number.trim())
      push(
        critical(
          'purchaseOrder.number',
          'PO number is required when a PO is required.',
          'purchaseOrder',
        ),
      )
    const amt = parseNumber(data.purchaseOrder.amount)
    if (!data.purchaseOrder.amount || amt <= 0)
      push(
        critical(
          'purchaseOrder.amount',
          'PO amount is required when a PO is required.',
          'purchaseOrder',
        ),
      )
  }

  return issues
}

/**
 * A section is "complete" when it has no critical issues **and** has at least
 * some non-empty content — used to render the green tick in section headers.
 */
export function sectionCompleteness(
  data: OrderFormData,
  issues: ValidationIssue[],
): Record<string, boolean> {
  const has = (id: string) => issues.some((i) => i.sectionId === id)
  return {
    customer:
      !has('customer') &&
      !!(data.customer.legalName && data.customer.orderFormDate && data.customer.preparedBy),
    soldTo: !has('soldTo') && !!(data.soldTo.name && data.soldTo.email),
    services:
      !has('services') &&
      data.services.some((l) => l.description.trim() && l.price && l.quantity),
    billing:
      !has('billing') &&
      !!(data.billing.billTo.name && data.billing.billTo.address) &&
      (data.billing.sameAsBillTo ||
        !!(data.billing.shipTo.name && data.billing.shipTo.address)),
    subscription: !has('subscription'),
    terms: true,
    signature: true,
    purchaseOrder:
      data.purchaseOrder.required === 'No' ||
      (!has('purchaseOrder') && !!data.purchaseOrder.number && !!data.purchaseOrder.amount),
  }
}
