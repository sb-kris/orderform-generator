import { AnimatePresence, motion } from 'motion/react'
import { Field, Section } from './Section'
import { Input } from '../ui/input'
import { CurrencyInput } from '../ui/currency-input'
import { RadioGroup, RadioGroupItem } from '../ui/radio-group'
import { useStore } from '@/state/store'
import { CURRENCIES } from '@/lib/currency'
import { sectionCompleteness, validate, sectionStarted } from '@/state/validation'

export function PurchaseOrderSection() {
  const { data, update } = useStore()
  const po = data.purchaseOrder
  const currency = data.currency
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'purchaseOrder').length
  const complete = sectionCompleteness(data, issues).purchaseOrder

  // Setting Yes clears No and vice versa – guaranteed by the RadioGroup pattern
  // since `required` is a single string value ('Yes' | 'No'), so the two options
  // are mutually exclusive in every render.
  const setRequired = (v: 'Yes' | 'No') =>
    update((p) => ({
      ...p,
      purchaseOrder: {
        required: v,
        number: v === 'No' ? '' : p.purchaseOrder.number,
        amount: v === 'No' ? '' : p.purchaseOrder.amount,
      },
    }))

  return (
    <Section
      id="purchaseOrder"
      number="08"
      title="Purchase Order"
      description="Whether the customer requires a purchase order to accompany the invoice."
      errorCount={errorCount}
      complete={complete}
      started={sectionStarted(data).purchaseOrder}
    >
      <Field label="Is a PO required?" required>
        <RadioGroup
          value={po.required}
          onValueChange={(v) => setRequired(v as 'Yes' | 'No')}
          className="flex gap-6"
        >
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="Yes" id="po-yes" />
            <span>Yes</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value="No" id="po-no" />
            <span>No</span>
          </label>
        </RadioGroup>
      </Field>

      <AnimatePresence initial={false}>
        {po.required === 'Yes' && (
          <motion.div
            key="po-details"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="grid gap-4 sm:grid-cols-2"
          >
            <Field label="PO Number" htmlFor="po.number" required>
              <Input
                id="po.number"
                value={po.number}
                onChange={(e) =>
                  update((p) => ({
                    ...p,
                    purchaseOrder: { ...p.purchaseOrder, number: e.target.value },
                  }))
                }
                placeholder="e.g. PO-2026-00123"
              />
            </Field>
            <Field label={`PO Amount (${CURRENCIES[currency].code})`} required>
              <CurrencyInput
                value={po.amount}
                onValueChange={(v) =>
                  update((p) => ({
                    ...p,
                    purchaseOrder: { ...p.purchaseOrder, amount: v },
                  }))
                }
                placeholder="0.00"
                currency={currency}
              />
            </Field>
          </motion.div>
        )}
      </AnimatePresence>
    </Section>
  )
}
