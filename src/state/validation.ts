/**
 * Legacy validation surface. The real logic now lives in the Document QA
 * engine (`src/lib/qa/documentQa.ts`); this module adapts that report into the
 * `ValidationIssue[]` shape the existing UI (section badges, nav counts,
 * ValidationSummary, export gating) already consumes.
 *
 * `validate()` intentionally returns only *blocking* issues (QA errors) so the
 * per-section issue counts keep their original "required fields still missing"
 * meaning. Warnings/suggestions are surfaced separately by the Readiness panel
 * via `runDocumentQa` directly.
 */
import type { OrderFormData } from './types'
import { runDocumentQa } from '@/lib/qa/documentQa'

export type ValidationIssue = {
  path: string
  message: string
  sectionId: string
  severity: 'critical' | 'warning'
}

/** All blocking issues (QA errors), mapped to the legacy issue shape. */
export function validate(data: OrderFormData): ValidationIssue[] {
  return runDocumentQa(data)
    .errors.map((c) => ({
      path: c.id,
      message: c.message,
      sectionId: c.sectionId,
      severity: 'critical' as const,
    }))
}

/** Fields whose absence blocks the Final PDF download. */
export function criticalIssues(data: OrderFormData): ValidationIssue[] {
  return validate(data)
}

/**
 * Whether the user has entered any data in a section yet. Drives the calm,
 * progressive section status (Not started → In progress → Complete) shown
 * before a readiness check has been run — so a blank form never looks broken.
 */
export function sectionStarted(data: OrderFormData): Record<string, boolean> {
  const c = data.customer
  const s = data.subscription
  const sig = data.signature
  const hasSig = (p: { signatureName: string; name: string; image: unknown }) =>
    !!(p.signatureName || p.name || p.image)
  return {
    customer: !!(
      c.legalName ||
      c.orderFormDate ||
      c.pricingValidThrough ||
      c.preparedBy ||
      data.customerLogo
    ),
    soldTo: !!(data.soldTo.name || data.soldTo.email),
    services: data.services.some(
      (l) => l.description.trim() || l.price || l.quantity,
    ),
    billing: !!(
      data.billing.billTo.name ||
      data.billing.billTo.address ||
      data.billing.shipTo.name ||
      data.billing.shipTo.address
    ),
    subscription: !!s.startDate,
    terms: false, // locked template — only reads "Complete" once validation runs
    signature: hasSig(sig.customer) || hasSig(sig.surveysparrow),
    purchaseOrder:
      data.purchaseOrder.required === 'Yes'
        ? !!(data.purchaseOrder.number || data.purchaseOrder.amount)
        : false,
  }
}

/**
 * A section is "complete" when it has no blocking issues **and** has at least
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
