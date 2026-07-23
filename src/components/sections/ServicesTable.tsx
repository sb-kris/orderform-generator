import { AnimatePresence, motion } from 'motion/react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { Section } from './Section'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { CurrencyInput } from '../ui/currency-input'
import { CurrencySelector } from '../ui/currency-selector'
import { useStore } from '@/state/store'
import { emptyLine, type ServiceLine } from '@/state/types'
import { formatCurrency, parseNumber } from '@/lib/format'
import { CURRENCIES, type CurrencyCode } from '@/lib/currency'
import { validate, sectionCompleteness, sectionStarted } from '@/state/validation'

export function ServicesTable() {
  const { data, update, totals } = useStore()
  const currency = data.currency
  const issues = validate(data)
  const errorCount = issues.filter((i) => i.sectionId === 'services').length
  const complete = sectionCompleteness(data, issues).services

  const setLine = (id: string, patch: Partial<ServiceLine>) => {
    update((p) => ({
      ...p,
      services: p.services.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }))
  }
  const addLine = () => update((p) => ({ ...p, services: [...p.services, emptyLine()] }))
  const removeLine = (id: string) =>
    update((p) => ({
      ...p,
      services:
        p.services.length > 1
          ? p.services.filter((l) => l.id !== id)
          : [emptyLine()],
    }))
  const duplicateLine = (id: string) =>
    update((p) => {
      const idx = p.services.findIndex((l) => l.id === id)
      if (idx === -1) return p
      const src = p.services[idx]
      const clone: ServiceLine = { ...src, id: crypto.randomUUID() }
      const next = [...p.services]
      next.splice(idx + 1, 0, clone)
      return { ...p, services: next }
    })

  const setCurrency = (code: CurrencyCode) =>
    update((p) => ({ ...p, currency: code }))

  return (
    <Section
      id="services"
      number="03"
      title="Services"
      description={`Line items · Subtotal = Price × Quantity · Currency: ${CURRENCIES[currency].label}`}
      errorCount={errorCount}
      complete={complete}
      started={sectionStarted(data).services}
      actions={
        <>
          <div className="hidden md:block">
            <CurrencySelector value={currency} onChange={setCurrency} label="" />
          </div>
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="h-3.5 w-3.5" /> Add row
          </Button>
        </>
      }
    >
      <div className="md:hidden">
        <CurrencySelector value={currency} onChange={setCurrency} />
      </div>
      <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-[10px] uppercase tracking-[0.12em] text-slate-500">
              <th className="px-3 py-2 font-semibold w-[40%]">Line Item</th>
              <th className="px-3 py-2 font-semibold w-[16%] text-right">Price</th>
              <th className="px-2 py-2 font-semibold w-[9%] text-center">Qty</th>
              <th className="px-2 py-2 font-semibold w-[13%] text-center">Unit</th>
              <th className="px-3 py-2 font-semibold w-[14%] text-right">Subtotal</th>
              <th className="px-2 py-2 font-semibold w-[8%] text-right">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {data.services.map((line, i) => {
                const subtotal = parseNumber(line.price) * parseNumber(line.quantity)
                return (
                  <motion.tr
                    key={line.id}
                    layout
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6, height: 0 }}
                    transition={{ duration: 0.15 }}
                    className="border-t border-slate-100 align-middle"
                  >
                    <td className="px-2 py-1.5">
                      <Input
                        value={line.description}
                        onChange={(e) => setLine(line.id, { description: e.target.value })}
                        placeholder={`e.g. NPS Software License – Enterprise Plan`}
                        aria-label={`Line ${i + 1} description`}
                        className="h-8"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <CurrencyInput
                        value={line.price}
                        onValueChange={(v) => setLine(line.id, { price: v })}
                        placeholder="0.00"
                        currency={currency}
                        aria-label={`Line ${i + 1} price`}
                        className="h-8"
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={line.quantity}
                        onChange={(e) =>
                          setLine(line.id, {
                            quantity: e.target.value.replace(/[^\d.]/g, ''),
                          })
                        }
                        inputMode="decimal"
                        placeholder="0"
                        className="h-8 text-center tabular-nums"
                        aria-label={`Line ${i + 1} quantity`}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <Input
                        value={line.unit}
                        onChange={(e) => setLine(line.id, { unit: e.target.value })}
                        maxLength={6}
                        className="h-8 text-center"
                        aria-label={`Unit for service line item ${i + 1}`}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-[13px] font-medium text-slate-900">
                      {formatCurrency(subtotal, currency)}
                    </td>
                    <td className="px-1 py-1.5">
                      <div className="flex justify-end gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicateLine(line.id)}
                          aria-label={`Duplicate line ${i + 1}`}
                          className="h-8 w-8 text-slate-400 hover:text-slate-700"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLine(line.id)}
                          aria-label={`Remove line ${i + 1}`}
                          className="h-8 w-8 text-slate-400 hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                )
              })}
            </AnimatePresence>
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-teal-400 bg-teal-50">
              <td
                colSpan={4}
                className="px-3 py-2.5 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-teal-800"
              >
                Total
              </td>
              <td className="px-3 py-2.5 text-right tabular-nums text-[15px] font-bold text-slate-950">
                {formatCurrency(totals.total, currency)}
              </td>
              <td className="bg-teal-50" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-[11px] text-slate-500">
        Rows without a description or values are skipped in the generated PDF —
        the on-screen table just keeps 6 rows visible for convenience.
      </p>
    </Section>
  )
}
