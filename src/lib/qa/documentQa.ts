/**
 * Document QA / Readiness engine.
 *
 * A single pure function, `runDocumentQa(data)`, that inspects an order form
 * and returns a structured report: individual checks (pass / warning / error),
 * a 0–100 readiness score, and a headline status. It is the one source of
 * truth for "is this document ready to send?" — the app's Readiness panel, the
 * export gating logic, and the legacy `validate()` adapter all consume it.
 *
 * Design notes
 * ------------
 *  - Pure and side-effect free: takes `OrderFormData`, derives everything it
 *    needs (it calls `buildDocModel` internally), returns a report. Safe to run
 *    on every render.
 *  - `error`   → a real problem that blocks the *Final* PDF (missing legal name,
 *                invalid email, no priced line, …).
 *  - `warning` → allowed but worth a human glance (expired pricing date, blank
 *                customer signature, logo/name mismatch, overflow risk).
 *  - `info`    → optional / FYI (no customer logo — perfectly fine).
 *  - `fieldId` (when set) is a DOM id the UI can focus + highlight; `sectionId`
 *    is always set for scroll-to-section navigation.
 */
import type { OrderFormData } from '@/state/types'
import { buildDocModel } from '@/lib/docModel'
import { parseNumber } from '@/lib/format'
import { checkLogoNameMatch } from './logoMatch'

export type QaStatus = 'pass' | 'warning' | 'error'
export type QaSeverity = 'critical' | 'high' | 'medium' | 'low' | 'info'

export type QaCheck = {
  /** Stable identifier, also used as the legacy issue `path`. */
  id: string
  /** Human-readable section name for grouping. */
  section: string
  /** Section id for scroll-to navigation (matches DOM section ids). */
  sectionId: string
  /** DOM id of the specific field to focus, when one exists. */
  fieldId?: string
  status: QaStatus
  severity: QaSeverity
  message: string
  /** Actionable, one-line guidance shown under the message. */
  suggestedFix: string
  /** Warnings can be acknowledged/ignored; errors never can. */
  canIgnore: boolean
  /**
   * Fingerprint of the fields this check depends on. When a warning is ignored
   * we record this key; if the fields later change the key differs and the
   * warning re-surfaces automatically. Empty for errors/passes.
   */
  dependencyKey: string
  /** True when the user has acknowledged this warning and its key still matches. */
  ignored: boolean
}

export type ReadinessStatus =
  | 'needs-attention'
  | 'almost-ready'
  | 'ready'
  | 'customer-ready'

export type QaReport = {
  checks: QaCheck[]
  errors: QaCheck[]
  /** Active (not-ignored) warnings — these count against the score. */
  warnings: QaCheck[]
  /** Warnings the user has acknowledged; excluded from the score. */
  ignored: QaCheck[]
  infos: QaCheck[]
  passes: QaCheck[]
  /** Count of blocking + active-warning issues. */
  issueCount: number
  score: number
  status: ReadinessStatus
  statusLabel: string
}

const SECTION_LABELS: Record<string, string> = {
  customer: 'Customer Information',
  soldTo: 'Sold To',
  services: 'Services',
  billing: 'Billing & Shipping',
  subscription: 'Subscription Details',
  terms: 'Terms & Conditions',
  signature: 'Execution / Signature',
  purchaseOrder: 'Purchase Order',
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Line-item descriptions longer than this risk truncation in the PDF table. */
const LINE_ITEM_OVERFLOW_CHARS = 58
/** Base64 payloads larger than this (~1.4 MB decoded) may render poorly / bloat. */
const LARGE_LOGO_DATAURL_CHARS = 1_400_000

type Draft = Omit<QaCheck, 'section' | 'canIgnore' | 'dependencyKey' | 'ignored'> & {
  canIgnore?: boolean
  dependencyKey?: string
}

export function runDocumentQa(data: OrderFormData): QaReport {
  const model = buildDocModel(data)
  const ignoredMap = data.ignoredWarnings ?? {}
  const checks: QaCheck[] = []

  const add = (c: Draft) => {
    // Warnings are ignorable by default; errors/passes never are.
    const canIgnore = c.canIgnore ?? c.status === 'warning'
    const dependencyKey = c.dependencyKey ?? ''
    // A warning is "ignored" only while its stored dependency key still matches
    // the current one — so editing the underlying field re-surfaces it.
    const ignored =
      canIgnore && c.status === 'warning' && ignoredMap[c.id] === dependencyKey
    checks.push({
      ...c,
      canIgnore,
      dependencyKey,
      ignored,
      section: SECTION_LABELS[c.sectionId] ?? c.sectionId,
    })
  }
  /** Emit a pass when `ok`, else an error with the given detail. */
  const req = (
    ok: boolean,
    id: string,
    sectionId: string,
    fieldId: string | undefined,
    label: string,
    failMessage: string,
    fix: string,
    passMessage?: string,
  ) =>
    add({
      id,
      sectionId,
      fieldId,
      status: ok ? 'pass' : 'error',
      severity: ok ? 'info' : 'critical',
      message: ok ? (passMessage ?? `${label} is set.`) : failMessage,
      suggestedFix: ok ? '' : fix,
    })

  // ---- Customer -------------------------------------------------------------
  req(
    !!data.customer.legalName.trim(),
    'customer.legalName',
    'customer',
    'customer.legalName',
    'Customer legal name',
    'Customer legal name is missing.',
    'Enter the customer’s full registered legal name.',
    'Customer legal name is present.',
  )
  req(
    !!data.customer.orderFormDate,
    'customer.orderFormDate',
    'customer',
    'customer.orderFormDate',
    'Order form date',
    'Order form date is missing.',
    'Set the date this order form is issued.',
  )
  req(
    !!data.customer.preparedBy.trim(),
    'customer.preparedBy',
    'customer',
    'customer.preparedBy',
    'Prepared By',
    'Prepared By is missing.',
    'Enter the SurveySparrow rep preparing this form.',
  )

  // Pricing valid-through: required, and must not be in the past.
  const pvtRaw = data.customer.pricingValidThrough
  if (!pvtRaw) {
    add({
      id: 'customer.pricingValidThrough',
      sectionId: 'customer',
      fieldId: 'customer.pricingValidThrough',
      status: 'error',
      severity: 'critical',
      message: 'Pricing valid-through date is missing.',
      suggestedFix: 'Set the date the quoted pricing expires.',
    })
  } else {
    const expired = isPastDate(pvtRaw)
    add({
      id: 'customer.pricingValidThrough.expired',
      sectionId: 'customer',
      fieldId: 'customer.pricingValidThrough',
      dependencyKey: pvtRaw,
      status: expired ? 'warning' : 'pass',
      severity: expired ? 'high' : 'info',
      message: expired
        ? `Pricing valid-through date (${model.customer.pricingValidThrough}) is in the past.`
        : 'Pricing valid-through date is set and current.',
      suggestedFix: expired
        ? 'Extend the pricing validity date before sending to the customer.'
        : '',
    })
  }

  // ---- Sold To --------------------------------------------------------------
  req(
    !!data.soldTo.name.trim(),
    'soldTo.name',
    'soldTo',
    'soldTo.name',
    'Sold To name',
    'Sold To contact name is missing.',
    'Enter the name of the person this is sold to.',
  )
  const email = data.soldTo.email.trim()
  add({
    id: 'soldTo.email',
    sectionId: 'soldTo',
    fieldId: 'soldTo.email',
    status: !email ? 'error' : EMAIL.test(email) ? 'pass' : 'error',
    severity: EMAIL.test(email) ? 'info' : 'critical',
    message: !email
      ? 'Sold To email is missing.'
      : EMAIL.test(email)
        ? 'Sold To email looks valid.'
        : 'Sold To email is not a valid email address.',
    suggestedFix: EMAIL.test(email) ? '' : 'Enter a valid email, e.g. jane@acme.com.',
  })

  // ---- Currency -------------------------------------------------------------
  add({
    id: 'currency',
    sectionId: 'services',
    status: 'pass',
    severity: 'info',
    message: `Currency is set to ${model.currencyCode}.`,
    suggestedFix: '',
  })

  // ---- Services -------------------------------------------------------------
  const populated = data.services.filter(
    (l) => l.description.trim() || l.price || l.quantity,
  )
  if (populated.length === 0) {
    add({
      id: 'services.empty',
      sectionId: 'services',
      status: 'error',
      severity: 'critical',
      message: 'No service line items have been added.',
      suggestedFix: 'Add at least one line item with a description, price, and quantity.',
    })
  } else {
    // Each populated line must be fully + validly filled.
    let lineErrors = 0
    populated.forEach((l) => {
      const p = parseNumber(l.price)
      const q = parseNumber(l.quantity)
      const bad =
        !l.description.trim() ||
        !l.price ||
        !Number.isFinite(p) ||
        p < 0 ||
        !l.quantity ||
        !Number.isFinite(q) ||
        q < 0
      if (bad) lineErrors++
    })
    add({
      id: 'services.lines',
      sectionId: 'services',
      status: lineErrors ? 'error' : 'pass',
      severity: lineErrors ? 'critical' : 'info',
      message: lineErrors
        ? `${lineErrors} service line${lineErrors === 1 ? '' : 's'} ${lineErrors === 1 ? 'is' : 'are'} missing a description, price, or quantity.`
        : `${populated.length} service line${populated.length === 1 ? '' : 's'} complete.`,
      suggestedFix: lineErrors
        ? 'Complete every started line (description + non-negative price and quantity), or clear it.'
        : '',
    })

    // Total must be greater than zero.
    add({
      id: 'services.total',
      sectionId: 'services',
      status: model.total > 0 ? 'pass' : 'error',
      severity: model.total > 0 ? 'info' : 'critical',
      message:
        model.total > 0
          ? `Order total is ${model.totalLabel}.`
          : 'Order total is zero.',
      suggestedFix:
        model.total > 0 ? '' : 'Enter a price and quantity so the total is greater than zero.',
    })

    // Overflow risk: very long descriptions truncate in the PDF services table.
    const longest = populated.reduce(
      (max, l) => Math.max(max, l.description.trim().length),
      0,
    )
    if (longest > LINE_ITEM_OVERFLOW_CHARS) {
      add({
        id: 'services.overflow',
        sectionId: 'services',
        dependencyKey: `len:${longest}`,
        status: 'warning',
        severity: 'medium',
        message: `A line item description is very long (${longest} characters) and may be shortened with “…” in the PDF.`,
        suggestedFix: 'Shorten the description or move detail into a follow-up note.',
      })
    }
  }

  // ---- Billing / Shipping ---------------------------------------------------
  req(
    !!data.billing.billTo.name.trim(),
    'billing.billTo.name',
    'billing',
    'billing.billTo.name',
    'Bill To name',
    'Bill To name is missing.',
    'Enter the billing contact/entity name.',
  )
  req(
    !!data.billing.billTo.address.trim(),
    'billing.billTo.address',
    'billing',
    'billing.billTo.address',
    'Bill To address',
    'Bill To address is missing.',
    'Enter the billing address.',
  )
  if (!data.billing.sameAsBillTo) {
    req(
      !!data.billing.shipTo.name.trim(),
      'billing.shipTo.name',
      'billing',
      'billing.shipTo.name',
      'Ship To name',
      'Ship To name is missing.',
      'Enter the shipping contact/entity name, or tick “same as Bill To”.',
    )
    req(
      !!data.billing.shipTo.address.trim(),
      'billing.shipTo.address',
      'billing',
      'billing.shipTo.address',
      'Ship To address',
      'Ship To address is missing.',
      'Enter the shipping address, or tick “same as Bill To”.',
    )
  }

  // ---- Subscription ---------------------------------------------------------
  const term = parseNumber(data.subscription.termMonths)
  req(
    !!(term && term > 0),
    'subscription.termMonths',
    'subscription',
    'subscription.termMonths',
    'Subscription term',
    'Subscription term must be a positive number of months.',
    'Enter the contract length in months (e.g. 12).',
  )
  req(
    !!data.subscription.startDate,
    'subscription.startDate',
    'subscription',
    'subscription.startDate',
    'Subscription start date',
    'Subscription start date is missing.',
    'Set when the subscription begins.',
  )
  // Payment method is a constrained select and always has a value.
  add({
    id: 'subscription.paymentMethod',
    sectionId: 'subscription',
    status: 'pass',
    severity: 'info',
    message: `Payment method is ${data.subscription.paymentMethod}.`,
    suggestedFix: '',
  })

  // ---- Purchase Order -------------------------------------------------------
  if (data.purchaseOrder.required === 'Yes') {
    req(
      !!data.purchaseOrder.number.trim(),
      'purchaseOrder.number',
      'purchaseOrder',
      'po.number',
      'PO number',
      'PO number is required because a PO is marked required.',
      'Enter the customer’s PO number.',
    )
    const amt = parseNumber(data.purchaseOrder.amount)
    req(
      !!(data.purchaseOrder.amount && amt > 0),
      'purchaseOrder.amount',
      'purchaseOrder',
      'po.amount',
      'PO amount',
      'PO amount is required because a PO is marked required.',
      'Enter the PO amount (greater than zero).',
    )
  } else {
    add({
      id: 'purchaseOrder.notRequired',
      sectionId: 'purchaseOrder',
      status: 'pass',
      severity: 'info',
      message: 'No purchase order required.',
      suggestedFix: '',
    })
  }

  // ---- Signatures -----------------------------------------------------------
  addSignatureChecks(add, data)

  // ---- Customer logo (optional) --------------------------------------------
  addLogoChecks(add, data)

  // ---- Manually edited legal text ------------------------------------------
  addTermsChecks(add, data)

  return summarize(checks)
}

function addTermsChecks(add: (c: Draft) => void, data: OrderFormData) {
  const overrides = data.termOverrides ?? {}
  const ids = Object.keys(overrides).sort()
  if (ids.length === 0) return
  // Fingerprint the override contents so re-editing an already-acknowledged
  // warning re-surfaces it (same mechanism as the other ignorable warnings).
  const dependencyKey = ids
    .map((id) => `${id}:${(overrides[id] ?? []).join('¶')}`)
    .join('||')
  add({
    id: 'terms.modified',
    sectionId: 'terms',
    dependencyKey,
    status: 'warning',
    severity: 'high',
    message: 'Legal text has been manually modified from the standard template.',
    suggestedFix:
      'Confirm the edited clauses are correct and legally approved before sending.',
  })
}

function addSignatureChecks(add: (c: Draft) => void, data: OrderFormData) {
  const cust = data.signature.customer
  const ss = data.signature.surveysparrow

  // NB: no check for a blank customer signature. In this workflow the customer
  // signs downstream (e.g. DocuSign), never inside the generated document, so a
  // blank customer signature at generation is the correct happy-path state — the
  // app has no opinion on it. (A blank-signature warning here would fire on every
  // order form and desensitise reps to the readiness engine's real warnings.)

  // If the customer picked "upload image" but attached nothing, that's a gap.
  if (cust.type === 'image' && !cust.image?.dataUrl) {
    add({
      id: 'signature.customer.image',
      sectionId: 'signature',
      fieldId: 'signature',
      dependencyKey: 'image-missing',
      status: 'warning',
      severity: 'medium',
      message: 'Customer signature method is “upload image” but no image is attached.',
      suggestedFix: 'Upload the signature image, or switch to a typed signature.',
    })
  }

  // SurveySparrow signatory identity should be filled (name + designation).
  const ssComplete = !!ss.name.trim() && !!ss.designation.trim()
  add({
    id: 'signature.surveysparrow',
    sectionId: 'signature',
    fieldId: 'signature',
    dependencyKey: `${ss.name.trim()}|${ss.designation.trim()}`,
    status: ssComplete ? 'pass' : 'warning',
    severity: ssComplete ? 'info' : 'low',
    message: ssComplete
      ? 'SurveySparrow signatory details are present.'
      : 'SurveySparrow signatory name or designation is missing.',
    suggestedFix: ssComplete
      ? ''
      : 'Fill in the SurveySparrow signer’s name and designation.',
  })
}

function addLogoChecks(add: (c: Draft) => void, data: OrderFormData) {
  const logo = data.customerLogo
  if (!logo?.dataUrl) {
    add({
      id: 'customer.logo.optional',
      sectionId: 'customer',
      status: 'pass',
      severity: 'info',
      message: 'No customer logo — optional, the document reads cleanly without one.',
      suggestedFix: '',
    })
    return
  }

  // Possible mismatch between logo filename and customer legal name.
  const match = checkLogoNameMatch(data.customer.legalName, logo.filename)
  if (!match.indeterminate && !match.matches) {
    add({
      id: 'customer.logo.mismatch',
      sectionId: 'customer',
      dependencyKey: `${data.customer.legalName.trim().toLowerCase()}|${(logo.filename ?? '').toLowerCase()}`,
      status: 'warning',
      severity: 'high',
      message: `The uploaded logo filename (“${logo.filename}”) does not appear to match ${data.customer.legalName}.`,
      suggestedFix: 'Confirm this is the correct customer’s logo before exporting.',
    })
  }

  // Oversized logo that may render poorly / bloat the file.
  if (logo.dataUrl.length > LARGE_LOGO_DATAURL_CHARS) {
    add({
      id: 'customer.logo.large',
      sectionId: 'customer',
      dependencyKey: `size:${logo.dataUrl.length}`,
      status: 'warning',
      severity: 'low',
      message: 'The uploaded customer logo is large and may render soft or bloat the file.',
      suggestedFix: 'Use a trimmed PNG/JPG under ~500 KB for the crispest result.',
    })
  }
}

/** ISO date is strictly before today (local midnight). */
function isPastDate(iso: string): boolean {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return d.getTime() < today.getTime()
}

const SEVERITY_WEIGHT: Record<QaStatus, number> = {
  error: 14,
  warning: 5,
  pass: 0,
}

function summarize(checks: QaCheck[]): QaReport {
  const errors = checks.filter((c) => c.status === 'error')
  const allWarnings = checks.filter((c) => c.status === 'warning')
  const warnings = allWarnings.filter((c) => !c.ignored) // active
  const ignored = allWarnings.filter((c) => c.ignored)
  const infos: QaCheck[] = [] // reserved; info surfaces via passes today
  const passes = checks.filter((c) => c.status === 'pass')

  // Ignored warnings are acknowledged and do NOT count against the score.
  const penalty =
    errors.length * SEVERITY_WEIGHT.error + warnings.length * SEVERITY_WEIGHT.warning
  const score = Math.max(0, Math.min(100, 100 - penalty))

  let status: ReadinessStatus
  if (errors.length) status = 'needs-attention'
  else if (warnings.length) status = 'almost-ready'
  else status = score >= 100 ? 'customer-ready' : 'ready'

  return {
    checks,
    errors,
    warnings,
    ignored,
    infos,
    passes,
    issueCount: errors.length + warnings.length,
    score,
    status,
    statusLabel: STATUS_LABELS[status],
  }
}

export const STATUS_LABELS: Record<ReadinessStatus, string> = {
  'needs-attention': 'Needs attention',
  'almost-ready': 'Almost ready',
  ready: 'Ready to generate',
  'customer-ready': 'Customer-ready',
}
