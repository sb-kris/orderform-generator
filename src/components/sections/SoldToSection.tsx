import { Field, Section } from './Section'
import { Input } from '../ui/input'
import { useStore } from '@/state/store'
import { validate, sectionCompleteness, sectionStarted } from '@/state/validation'

export function SoldToSection() {
  const { data, update } = useStore()
  const s = data.soldTo
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'soldTo').length
  const complete = sectionCompleteness(data, issues).soldTo
  return (
    <Section
      id="soldTo"
      number="02"
      title="Sold To"
      description="Primary contact this order form is being sold to."
      errorCount={errorCount}
      complete={complete}
      started={sectionStarted(data).soldTo}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" htmlFor="soldTo.name" required>
          <Input
            id="soldTo.name"
            value={s.name}
            onChange={(e) =>
              update((p) => ({ ...p, soldTo: { ...p.soldTo, name: e.target.value } }))
            }
            placeholder="e.g. Jane Doe"
          />
        </Field>
        <Field label="Email" htmlFor="soldTo.email" required>
          <Input
            id="soldTo.email"
            type="email"
            value={s.email}
            onChange={(e) =>
              update((p) => ({ ...p, soldTo: { ...p.soldTo, email: e.target.value } }))
            }
            placeholder="e.g. jane.doe@acme.com"
          />
        </Field>
      </div>
    </Section>
  )
}
