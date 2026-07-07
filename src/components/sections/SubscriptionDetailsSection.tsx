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
import { useStore } from '@/state/store'
import type { BillingPeriod, PaymentMethod } from '@/state/types'
import { sectionCompleteness, validate } from '@/state/validation'

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
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'subscription').length
  const complete = sectionCompleteness(data, issues).subscription
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
      </div>
      <div className="rounded-lg border border-dashed border-teal-200 bg-teal-50/60 p-3 text-[12px] text-teal-800">
        Payable within 30 days upon the receipt of invoice.
      </div>
    </Section>
  )
}
