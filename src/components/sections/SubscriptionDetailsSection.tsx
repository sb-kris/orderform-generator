import { useState } from 'react'
import { Field, Section } from './Section'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { DateInput } from '../ui/date-input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog'
import { useStore } from '@/state/store'
import { PAYMENT_METHODS, type BillingPeriod, type PaymentMethod } from '@/state/types'
import { sectionCompleteness, validate, sectionStarted } from '@/state/validation'
import {
  NET_TERMS,
  PAYMENT_CLAUSE_ID,
  payableNote,
  resolvePaymentTerm,
  type PaymentTermMode,
} from '@/lib/terms'

const BILLING_PERIODS: BillingPeriod[] = [
  'Monthly',
  'Quarterly',
  'Annual',
  'Biennial',
  'Triennial',
]

/** Payment-term dropdown options. Net terms + Due-on-receipt + free-text Custom. */
const PAYMENT_TERM_OPTIONS: Array<{ value: string; label: string }> = [
  ...NET_TERMS.map((n) => ({ value: `net-${n}`, label: `Net ${n}` })),
  { value: 'due-on-receipt', label: 'Due on receipt' },
  { value: 'custom', label: 'Custom…' },
]

type PaymentTermPatch = {
  paymentTermMode: PaymentTermMode
  paymentTermDays: number
  paymentTermCustom: string
}

export function SubscriptionDetailsSection() {
  const { data, update } = useStore()
  const s = data.subscription
  const term = resolvePaymentTerm(s)
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'subscription').length
  const complete = sectionCompleteness(data, issues).subscription

  // The committed dropdown value for the current term.
  const currentOption =
    term.mode === 'custom'
      ? 'custom'
      : term.mode === 'due-on-receipt'
        ? 'due-on-receipt'
        : `net-${term.netDays}`

  // Translate a dropdown option into the subscription patch, preserving the
  // existing custom wording / net days where they aren't being replaced.
  const optionToPatch = (opt: string): PaymentTermPatch => {
    if (opt === 'due-on-receipt') {
      return { paymentTermMode: 'due-on-receipt', paymentTermDays: term.netDays, paymentTermCustom: term.customText }
    }
    if (opt === 'custom') {
      return { paymentTermMode: 'custom', paymentTermDays: term.netDays, paymentTermCustom: s.paymentTermCustom ?? '' }
    }
    return { paymentTermMode: 'net', paymentTermDays: Number(opt.replace('net-', '')), paymentTermCustom: term.customText }
  }

  // Changing the payment term rewrites the binding Subscription Fees & Payment
  // clause, so it is gated behind an explicit confirmation. `pending` holds the
  // proposed option while the dialog is open; the Select stays bound to the
  // committed value so Cancel leaves everything unchanged.
  const [pending, setPending] = useState<string | null>(null)
  // A payment-term change re-interpolates the payment clause, so any manual edit
  // to it must be dropped to preserve the callout-vs-clause invariant.
  const paymentOverridden = !!data.termOverrides?.[PAYMENT_CLAUSE_ID]

  const pendingPatch = pending ? optionToPatch(pending) : null
  const pendingLabel = PAYMENT_TERM_OPTIONS.find((o) => o.value === pending)?.label ?? ''

  const applyPending = () => {
    if (!pending) return
    const patch = optionToPatch(pending)
    update((p) => {
      const termOverrides = { ...p.termOverrides }
      delete termOverrides[PAYMENT_CLAUSE_ID]
      return {
        ...p,
        subscription: { ...p.subscription, ...patch },
        termOverrides,
      }
    })
    setPending(null)
  }

  const setCustomText = (value: string) =>
    update((p) => ({
      ...p,
      subscription: { ...p.subscription, paymentTermCustom: value },
    }))

  return (
    <Section
      id="subscription"
      number="05"
      title="Subscription Details"
      description="Cadence and payment terms for the subscription."
      errorCount={errorCount}
      complete={complete}
      started={sectionStarted(data).subscription}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Billing Period" required>
          <Select
            value={s.billingPeriod}
            onValueChange={(v) =>
              update((p) => ({
                ...p,
                subscription: { ...p.subscription, billingPeriod: v as BillingPeriod },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BILLING_PERIODS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Subscription Term (Months)" htmlFor="subscription.termMonths" required>
          <Input
            id="subscription.termMonths"
            inputMode="numeric"
            value={s.termMonths}
            onChange={(e) =>
              update((p) => ({
                ...p,
                subscription: {
                  ...p.subscription,
                  termMonths: e.target.value.replace(/[^\d]/g, ''),
                },
              }))
            }
            placeholder="e.g. 12"
          />
        </Field>
        <Field label="Subscription Term Start Date" htmlFor="subscription.startDate">
          <DateInput
            id="subscription.startDate"
            value={s.startDate}
            onChange={(e) =>
              update((p) => ({
                ...p,
                subscription: { ...p.subscription, startDate: e.target.value },
              }))
            }
          />
        </Field>
        <Field label="Payment Method">
          <Select
            value={s.paymentMethod || undefined}
            onValueChange={(v) =>
              update((p) => ({
                ...p,
                subscription: { ...p.subscription, paymentMethod: v as PaymentMethod },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Select payment method" />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Payment Term" hint="Drives the payment callout and the Subscription Fees & Payment clause.">
          <Select
            value={currentOption}
            onValueChange={(v) => {
              if (v !== currentOption) setPending(v)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAYMENT_TERM_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        {term.mode === 'custom' && (
          <Field
            label="Custom Payment Term Wording"
            htmlFor="subscription.paymentTermCustom"
            className="sm:col-span-2"
            hint="Completes “…payable ___” in the clause and callout. Enter the part after “payable”, e.g. “in three equal monthly installments”."
          >
            <Input
              id="subscription.paymentTermCustom"
              value={s.paymentTermCustom}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="e.g. in three equal monthly installments"
              maxLength={160}
            />
          </Field>
        )}
      </div>
      <p className="text-[11px] text-slate-500">
        Start date and payment method can be completed later if the order form is being
        sent for review.
      </p>
      <div className="rounded-lg border border-dashed border-teal-200 bg-teal-50/60 p-3 text-[12px] text-teal-800">
        {payableNote(s)}
      </div>

      <Field
        label="Payment Terms Comments"
        htmlFor="paymentTerms.comments"
        hint="Use this only when the customer or internal reviewer requests changes to payment terms. It appears in the document only when filled, and stays editable in the Fillable PDF."
      >
        <Textarea
          id="paymentTerms.comments"
          value={data.paymentTermsComments}
          onChange={(e) =>
            update((p) => ({ ...p, paymentTermsComments: e.target.value }))
          }
          placeholder="Optional — add comments only if the payment terms require review."
          maxLength={600}
          className="min-h-[64px]"
        />
      </Field>
      <p className="text-[11px] text-slate-500">
        Use comments for customer review feedback. Accepted changes should be reviewed
        internally before generating the Final PDF.
      </p>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
      >
        <DialogContent>
          <div className="p-6">
            <DialogTitle className="pr-6">Update payment term to {pendingLabel}?</DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              {pending === 'custom' ? (
                <>
                  This switches the payment term to custom wording. The payment callout and the
                  Subscription Fees &amp; Payment clause will use the exact text you enter next.
                </>
              ) : (
                <>
                  This updates the payment callout and the Subscription Fees &amp; Payment clause to
                  read “{pendingPatch ? payableNote(pendingPatch) : ''}”.
                </>
              )}
              {paymentOverridden && (
                <span className="mt-2 block font-medium text-amber-700">
                  Your manual edit to the Subscription Fees &amp; Payment clause will be reset to the
                  standard text for {pendingLabel}.
                </span>
              )}
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={applyPending}>
                Update payment term
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
