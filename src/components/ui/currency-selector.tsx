import { CURRENCIES, type CurrencyCode } from '@/lib/currency'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select'

export function CurrencySelector({
  value,
  onChange,
  className,
  label = 'Currency',
}: {
  value: CurrencyCode
  onChange: (code: CurrencyCode) => void
  className?: string
  label?: string
}) {
  return (
    <div className={className}>
      {label && (
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {label}
        </div>
      )}
      <Select value={value} onValueChange={(v) => onChange(v as CurrencyCode)}>
        <SelectTrigger className="h-9 w-full min-w-[128px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(CURRENCIES).map((c) => (
            <SelectItem key={c.code} value={c.code}>
              {c.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
