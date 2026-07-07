import { Field, Section } from './Section'
import { Input } from '../ui/input'
import { DateInput } from '../ui/date-input'
import { ImageUpload } from '../ui/image-upload'
import { useStore } from '@/state/store'
import { validate, sectionCompleteness, sectionStarted } from '@/state/validation'

export function CustomerInfoSection() {
  const { data, update } = useStore()
  const c = data.customer
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'customer').length
  const complete = sectionCompleteness(data, issues).customer
  return (
    <Section
      id="customer"
      number="01"
      title="Customer Information"
      description="Basic identifiers for the customer and this order form."
      errorCount={errorCount}
      complete={complete}
      started={sectionStarted(data).customer}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Customer Legal Name" htmlFor="customer.legalName" required className="sm:col-span-2">
          <Input
            id="customer.legalName"
            value={c.legalName}
            onChange={(e) =>
              update((p) => ({
                ...p,
                customer: { ...p.customer, legalName: e.target.value },
              }))
            }
            placeholder="e.g. Acme Corporation, Inc."
          />
        </Field>
        <Field label="Order Form Date" htmlFor="customer.orderFormDate" required>
          <DateInput
            id="customer.orderFormDate"
            value={c.orderFormDate}
            onChange={(e) =>
              update((p) => ({
                ...p,
                customer: { ...p.customer, orderFormDate: e.target.value },
              }))
            }
          />
        </Field>
        <Field label="Pricing Valid Through" htmlFor="customer.pricingValidThrough" required>
          <DateInput
            id="customer.pricingValidThrough"
            value={c.pricingValidThrough}
            onChange={(e) =>
              update((p) => ({
                ...p,
                customer: { ...p.customer, pricingValidThrough: e.target.value },
              }))
            }
          />
        </Field>
        <Field label="Prepared By" htmlFor="customer.preparedBy" required>
          <Input
            id="customer.preparedBy"
            value={c.preparedBy}
            onChange={(e) =>
              update((p) => ({
                ...p,
                customer: { ...p.customer, preparedBy: e.target.value },
              }))
            }
            placeholder="e.g. Trent Ward"
          />
        </Field>
        <ImageUpload
          value={data.customerLogo}
          onChange={(asset) => update((p) => ({ ...p, customerLogo: asset }))}
          label="Customer Logo (optional)"
          hint="Appears on page 1 of the generated document."
        />
      </div>
    </Section>
  )
}
