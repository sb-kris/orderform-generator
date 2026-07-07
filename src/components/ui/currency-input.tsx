import { forwardRef, useCallback, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import { CURRENCIES, type CurrencyCode } from '@/lib/currency'

interface CurrencyInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value' | 'type'> {
  value: string
  onValueChange: (raw: string) => void
  invalid?: boolean
  currency?: CurrencyCode
}

/**
 * Numeric input that stores a plain-string value so `parseNumber` can consume
 * it. Prefixes the currency symbol so users know what they're typing.
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onValueChange, className, invalid, currency = 'USD', ...props }, ref) => {
    const onChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value.replace(/[^\d.]/g, '')
        const parts = raw.split('.')
        const normalized = parts.length > 1 ? `${parts[0]}.${parts.slice(1).join('')}` : raw
        onValueChange(normalized)
      },
      [onValueChange],
    )
    const symbol = CURRENCIES[currency]?.symbol ?? '$'
    return (
      <div className="relative w-full">
        <span
          className={cn(
            'pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500',
            symbol.length > 1 && 'text-xs',
          )}
        >
          {symbol}
        </span>
        <input
          ref={ref}
          value={value}
          onChange={onChange}
          inputMode="decimal"
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-card pr-3 text-sm tabular-nums text-right shadow-sm placeholder:text-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
            symbol.length > 1 ? 'pl-9' : 'pl-7',
            invalid && 'border-destructive focus-visible:ring-destructive',
            className,
          )}
          {...props}
        />
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
