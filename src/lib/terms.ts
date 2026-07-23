/**
 * SurveySparrow standard order-form terms.
 *
 * These are treated as locked legal text in the UI. They may only be updated
 * with legal review. Keep the array structure (title + paragraphs) so that
 * both the on-screen accordion and the PDF/DOCX renderers can consume them.
 *
 * The Subscription Fees & Payment clause is DYNAMIC: it carries a
 * `{{PAYMENT_TERM_LEGAL_TEXT}}` token that `buildTerms` interpolates from the
 * selected payment term, so the payment callout and the binding legal clause
 * can never disagree.
 */
export type TermClause = {
  /** Stable id (never the title) — used to target payment-term interpolation and
   *  per-document text overrides so clause numbering/titles stay locked. */
  id: string
  title: string
  paragraphs: string[]
}

/** How the payment term is expressed. */
export type PaymentTermMode = 'net' | 'due-on-receipt' | 'custom'

/**
 * The minimal shape the payment-term helpers need. `OrderFormData['subscription']`
 * satisfies this structurally, so callers just pass the subscription object.
 */
export type PaymentTermFields = {
  paymentTermMode?: PaymentTermMode
  paymentTermDays?: number
  paymentTermCustom?: string
}

/** The supported net payment terms (days). Locked to these values. */
export const NET_TERMS = [15, 30, 45, 60] as const
export type NetTerm = (typeof NET_TERMS)[number]

/** Spelled-out numerals for the legal clause. No dependency — values are fixed. */
export const NET_TERM_WORDS: Record<number, string> = {
  15: 'fifteen',
  30: 'thirty',
  45: 'forty-five',
  60: 'sixty',
}

/** Clause id of the dynamic Subscription Fees & Payment clause. Shared so the
 *  Subscription section can drop a manual override on that clause when the
 *  payment term changes (keeping the callout-vs-clause invariant). */
export const PAYMENT_CLAUSE_ID = 'fees-payment'

/** The token in the locked template that carries the dynamic payment wording. */
const PAYMENT_TERM_TOKEN = '{{PAYMENT_TERM_LEGAL_TEXT}}'

/** Coerce any stored value to a supported net term (guards old drafts). */
function normalizeNetTerm(days?: number): NetTerm {
  return (NET_TERMS as readonly number[]).includes(days ?? NaN) ? (days as NetTerm) : 30
}

function cleanCustom(text?: string): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

/**
 * The custom wording is meant to COMPLETE "…payable ___" in the clause and
 * callout. Strip a leading "payable" (however the rep typed it) plus any
 * trailing punctuation so we never emit "payable payable …" or a double period.
 */
function customBody(text?: string): string {
  return cleanCustom(text)
    .replace(/^payable\s+/i, '')
    .replace(/[.\s]+$/, '')
    .trim()
}

export type ResolvedPaymentTerm = {
  mode: PaymentTermMode
  netDays: NetTerm
  customText: string
}

/** Normalise the raw subscription payment-term fields into a resolved shape. */
export function resolvePaymentTerm(f: PaymentTermFields): ResolvedPaymentTerm {
  const mode: PaymentTermMode = f.paymentTermMode ?? 'net'
  return {
    mode,
    netDays: normalizeNetTerm(f.paymentTermDays),
    customText: cleanCustom(f.paymentTermCustom),
  }
}

/**
 * The one-line payment callout string. Single source shared by the app
 * Subscription callout, the preview, the PDF, and the DOCX (via buildDocModel).
 */
export function payableNote(f: PaymentTermFields): string {
  const t = resolvePaymentTerm(f)
  if (t.mode === 'due-on-receipt') return 'Payable upon receipt of invoice.'
  if (t.mode === 'custom') {
    const body = customBody(t.customText)
    return body ? `Payable ${body}.` : 'Payment terms to be confirmed.'
  }
  return `Payable within ${t.netDays} days upon receipt of invoice.`
}

/**
 * The dynamic payment fragment that replaces `{{PAYMENT_TERM_LEGAL_TEXT}}` in
 * the binding Subscription Fees & Payment clause. Returns the phrase that
 * follows "...expressly set forth above," in the clause sentence, e.g.
 *   Net 30          → "payable within thirty (30) days of receipt of the invoice"
 *   Due on receipt  → "payable upon receipt of the invoice"
 *   Custom          → "payable <custom wording>"
 * Never returns the raw token, so no placeholder can leak into a document.
 */
export function formatPaymentTermLegalText(f: PaymentTermFields): string {
  const t = resolvePaymentTerm(f)
  if (t.mode === 'due-on-receipt') return 'payable upon receipt of the invoice'
  if (t.mode === 'custom') {
    const body = customBody(t.customText)
    return body
      ? `payable ${body}`
      : 'payable in accordance with the payment terms agreed between the Parties'
  }
  const word = NET_TERM_WORDS[t.netDays] ?? String(t.netDays)
  return `payable within ${word} (${t.netDays}) days of receipt of the invoice`
}

/**
 * Locked SurveySparrow order-form terms with the payment clause's wording
 * driven by the chosen payment term, so the callout and the binding clause can
 * never disagree.
 *
 * `overrides` is a per-document map (clause id → paragraphs) applied AFTER the
 * payment-term interpolation: any clause whose id is present has its paragraphs
 * replaced wholesale (empty paragraphs dropped). Titles/numbering are NEVER
 * overridden. BASE_TERMS itself is never mutated — overrides live with the draft.
 */
export function buildTerms(
  f: PaymentTermFields,
  overrides?: Record<string, string[]>,
): TermClause[] {
  const legal = formatPaymentTermLegalText(f)
  return BASE_TERMS.map((clause) => {
    let next = clause
    // Payment-term interpolation: replace the token wherever it appears.
    if (clause.paragraphs.some((p) => p.includes(PAYMENT_TERM_TOKEN))) {
      next = {
        ...clause,
        paragraphs: clause.paragraphs.map((p) => p.split(PAYMENT_TERM_TOKEN).join(legal)),
      }
    }
    const override = overrides?.[clause.id]
    if (override) {
      const paragraphs = override.map((p) => p.trim()).filter(Boolean)
      if (paragraphs.length) next = { ...next, paragraphs }
    }
    return next
  })
}

const BASE_TERMS: TermClause[] = [
  {
    id: 'order-tos',
    title: '1. Order Form & Terms of Service',
    paragraphs: [
      'This Order Form is entered into by the customer listed above (the "Customer") and SurveySparrow Inc. ("SurveySparrow") for the purchase of a subscription to the Services listed above. This Order Form is effective as of the Subscription Term Start Date (the "Order Form Effective Date") and will be valid for the entire Subscription Term as set forth above, unless terminated sooner by either Party in accordance with the Terms of Service.',
      'This Order Form is entered into by and between the Parties pursuant to the SurveySparrow Terms of Service located at https://surveysparrow.com/terms (hereinafter referred to as the "Terms of Service"). By executing this Order Form, the Customer agrees to be bound by all terms and conditions of this Order Form and the Terms of Service, including any amendments.',
      'In the event of any conflict between the Terms of Service and this Order Form, this Order Form shall govern. No provision of any purchase order ("PO") or other business form employed by the Customer will supersede the terms and conditions of this Order Form, and any such document relating to this Order Form will be for administrative purposes only and shall have no legal effect.',
    ],
  },
  {
    id: 'services-support',
    title: '2. Subscription Services & Support',
    paragraphs: [
      'SurveySparrow shall provide the Customer with support services in accordance with the support package included in the applicable Subscription Services. Custom apps, custom development, integrations, and migrations are not included as part of the support packages.',
      'As of the Subscription Term Start Date set forth above, this Order Form supersedes and replaces any outstanding Order Forms between SurveySparrow and the Customer, and any such outstanding Order Forms are terminated in their entirety.',
    ],
  },
  {
    id: PAYMENT_CLAUSE_ID,
    title: '3. Subscription Fees, Billing Period & Payment',
    paragraphs: [
      'The Customer is invoiced based on the annual "Billing Period" during the Subscription Term as designated above.',
      `Subscription Fees and Payment: In consideration of the Subscription Services provided by SurveySparrow, the Customer agrees to make the total payment of the annual subscription fee expressly set forth above, ${PAYMENT_TERM_TOKEN}, irrespective of use of the Services.`,
    ],
  },
  {
    id: 'renewals',
    title: '4. Renewals, Plan Changes & Cancellation',
    paragraphs: [
      'If the Customer changes plans during a Billing Period, the adjustable fees will be adjusted accordingly as of the date of the change.',
      'The Customer acknowledges and agrees that: (i) for annual subscription renewals, there shall be an automatic increase of seven percent (7%) in the previous subscription fee paid by the Customer, which will be payable on the subsequent Pay Date; and (ii) for quarterly subscription renewals, the payment shall be made in accordance with the standard subscription fee detailed in the pricing plan published on SurveySparrow’s website and in compliance with the terms set forth in the applicable Order Form.',
      'In the event the Customer terminates the Account during the annual Subscription Period, the Customer agrees to pay a one-time cancellation fee computed at 50% of the entire outstanding amount payable for the remaining Subscription Period, payable within 30 days from the date of such notice of termination.',
      'Unless otherwise specified with 45 days’ advance notice, this Order Form will be auto-renewed. SurveySparrow will invoice the Customer in advance for each Billing Period. The invoice will be based upon the Customer’s then-current monthly fee plus any adjustments from the prior Billing Period.',
    ],
  },
  {
    id: 'po-invoicing',
    title: '5. Purchase Orders & Invoicing',
    paragraphs: [
      'The Customer will indicate below whether a PO is required. If no answer is provided, or if the Customer indicates that no PO is required, the Customer agrees that SurveySparrow may issue invoice(s) without referencing a PO and that SurveySparrow is entitled to payment of such invoice(s) without the requirement of a PO. In the event that the Customer indicates that a PO is required in the section below, the Customer agrees to provide the required PO for the provisioning of any Services.',
    ],
  },
  {
    id: 'confidentiality',
    title: '6. Confidentiality',
    paragraphs: [
      'The above material is proprietary, privileged, and confidential. Its distribution to third parties is not allowed without the express written permission of SurveySparrow.',
    ],
  },
  {
    id: 'authorization',
    title: '7. Authorization to Execute',
    paragraphs: [
      'The undersigned hereby represents and warrants that he or she is duly authorized to execute this agreement on behalf of the Customer or the party on whose behalf he or she is signing.',
    ],
  },
  {
    id: 'taxes',
    title: '8. Taxes, Withholding & Bank Charges',
    paragraphs: [
      'Subscription charges specified herein are exclusive of tax under applicable law, and the Customer is liable to remit the tax under the reverse charge mechanism as per the applicable law of the service recipient’s country.',
      'No TDS / withholding tax shall be deductible from the subscription charges payable by the Customer.',
      'All applicable bank charges over and above the subscription charges specified herein shall be borne by the Customer.',
    ],
  },
  {
    id: 'payment-methods',
    title: '9. Accepted Payment Methods',
    paragraphs: [
      'The Customer shall remit payments using any of the following accepted payment methods: Wire Transfer, ACH, Credit Card, or Check, as deemed acceptable by SurveySparrow. If the Customer chooses to remit payment via check, the Customer expressly agrees and acknowledges that: (1) all checks shall be drawn exclusively from banks located within the United States, and checks issued from foreign banks shall not be accepted; (2) the check must be sent to the specific mailing address indicated on the invoice; and (3) the Customer shall, within two days from the date of dispatch, provide the courier and tracking details to SurveySparrow by emailing bills@surveysparrow.com to ensure timely processing.',
    ],
  },
]
