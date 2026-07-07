import { useState } from 'react'
import { Field, Section } from './Section'
import { Input } from '../ui/input'
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
import type { BillingPeriod, PaymentMethod } from '@/state/types'
import { sectionCompleteness, validate } from '@/state/validation'
import { NET_TERMS, NET_TERM_WORDS, payableNote } from '@/lib/terms'

const BILLING_PERIODS: BillingPeriod[] = [
  'Monthly',
  'Quarterly',
  'Annual',
  'Biennial',
  'Triennial',
]
const PAYMENT_METHODS: PaymentMethod[] = [
  'ACH / Bank Transfer',
  'Wire Transfer',
  'Credit Card',
  'Check',
]

export function SubscriptionDetailsSection() {
  const { data, update } = useStore()
  const s = data.subscription
  const netDays = s.paymentTermDays ?? 30
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'subscription').length
  const complete = sectionCompleteness(data, issues).subscription

  // Changing the net term rewrites the binding Payment Terms clause, so it is
  // gated behind an explicit confirmation. `pending` holds the proposed value
  // while the dialog is open; the Select stays bound to the committed value so
  // Cancel leaves everything unchanged.
  const [pending, setPending] = useState<number | null>(null)
  // A net-term change re-interpolates the payment clause, so any manual edit to
  // it must be dropped to preserve the callout-vs-clause invariant.
  const paymentOverridden = !!data.termOverrides?.payment

  const applyPending = () => {
    if (pending === null) return
    const next = pending
    update((p) => {
      const termOverrides = { ...p.termOverrides }
      delete termOverrides.payment
      return {
        ...p,
        subscription: { ...p.subscription, paymentTermDays: next },
        termOverrides,
      }
    })
    setPending(null)
  }

  return (
    <Section
      id="subscription"
      number="05"
      title="Subscription Details"
      description="Cadence and payment terms for the subscription."
      errorCount={errorCount}
      complete={complete}
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
        <Field label="Subscription Term Start Date" htmlFor="subscription.startDate" required>
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
        <Field label="Payment Method" required>
          <Select
            value={s.paymentMethod}
            onValueChange={(v) =>
              update((p) => ({
                ...p,
                subscription: { ...p.subscription, paymentMethod: v as PaymentMethod },
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
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
        <Field label="Payment Term" hint="Drives the payment callout and Payment Terms clause 3.">
          <Select
            value={String(netDays)}
            onValueChange={(v) => {
              const next = Number(v)
              if (next !== netDays) setPending(next)
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NET_TERMS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  Net {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <div className="rounded-lg border border-dashed border-teal-200 bg-teal-50/60 p-3 text-[12px] text-teal-800">
        {payableNote(netDays)}
      </div>

      <Dialog
        open={pending !== null}
        onOpenChange={(o) => {
          if (!o) setPending(null)
        }}
      >
        <DialogContent>
          <div className="p-6">
            <DialogTitle className="pr-6">Change payment term to Net {pending}?</DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              This will also update the Payment Terms clause in the order form’s legal text to
              read “{pending !== null ? NET_TERM_WORDS[pending] : ''} ({pending}) days”.
              {paymentOverridden && (
                <span className="mt-2 block font-medium text-amber-700">
                  Your manual edit to the Payment Terms clause will be reset to the standard
                  text for Net {pending}.
                </span>
              )}
            </DialogDescription>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPending(null)}>
                Cancel
              </Button>
              <Button size="sm" onClick={applyPending}>
                Change to Net {pending}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
