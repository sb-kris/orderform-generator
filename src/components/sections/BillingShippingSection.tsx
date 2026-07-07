import { Field, Section } from './Section'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import { Switch } from '../ui/switch'
import { useStore } from '@/state/store'
import { sectionCompleteness, validate, sectionStarted } from '@/state/validation'

export function BillingShippingSection() {
  const { data, update } = useStore()
  const b = data.billing
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'billing').length
  const complete = sectionCompleteness(data, issues).billing

  const setBill = (patch: Partial<typeof b.billTo>) =>
    update((p) => ({
      ...p,
      billing: { ...p.billing, billTo: { ...p.billing.billTo, ...patch } },
    }))
  const setShip = (patch: Partial<typeof b.shipTo>) =>
    update((p) => ({
      ...p,
      billing: { ...p.billing, shipTo: { ...p.billing.shipTo, ...patch } },
    }))
  const setSame = (v: boolean) =>
    update((p) => ({
      ...p,
      billing: {
        ...p.billing,
        sameAsBillTo: v,
        shipTo: v ? { ...p.billing.billTo } : p.billing.shipTo,
      },
    }))

  return (
    <Section
      id="billing"
      number="04"
      title="Billing & Shipping"
      description="Where invoices and any physical materials should be sent."
      errorCount={errorCount}
      complete={complete}
      started={sectionStarted(data).billing}
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
          <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
            Bill To
          </div>
          <div className="grid gap-3">
            <Field label="Name" htmlFor="billing.billTo.name" required>
              <Input
                id="billing.billTo.name"
                value={b.billTo.name}
                onChange={(e) => setBill({ name: e.target.value })}
                placeholder="e.g. Accounts Payable, Acme Corp."
              />
            </Field>
            <Field label="Address" htmlFor="billing.billTo.address" required>
              <Textarea
                id="billing.billTo.address"
                rows={3}
                value={b.billTo.address}
                onChange={(e) => setBill({ address: e.target.value })}
                placeholder="123 Main Street&#10;San Francisco, CA 94103&#10;United States"
              />
            </Field>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/40 p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-700">
              Ship To
            </div>
            <label className="flex items-center gap-2 text-[11px] text-slate-600">
              Same as Bill To
              <Switch
                checked={b.sameAsBillTo}
                onCheckedChange={setSame}
                aria-label="Ship to same as bill to"
              />
            </label>
          </div>
          <div className="grid gap-3">
            <Field label="Name" htmlFor="billing.shipTo.name" required={!b.sameAsBillTo}>
              <Input
                id="billing.shipTo.name"
                disabled={b.sameAsBillTo}
                value={b.sameAsBillTo ? b.billTo.name : b.shipTo.name}
                onChange={(e) => setShip({ name: e.target.value })}
                placeholder="e.g. Facilities, Acme Corp."
              />
            </Field>
            <Field label="Address" htmlFor="billing.shipTo.address" required={!b.sameAsBillTo}>
              <Textarea
                id="billing.shipTo.address"
                rows={3}
                disabled={b.sameAsBillTo}
                value={b.sameAsBillTo ? b.billTo.address : b.shipTo.address}
                onChange={(e) => setShip({ address: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </div>
    </Section>
  )
}
