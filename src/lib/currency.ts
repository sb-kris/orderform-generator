export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'INR' | 'CAD' | 'AUD'

export type Currency = {
  code: CurrencyCode
  symbol: string
  label: string
  locale: string
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  USD: { code: 'USD', symbol: '$', label: 'USD ($)', locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', label: 'EUR (€)', locale: 'en-IE' },
  GBP: { code: 'GBP', symbol: '£', label: 'GBP (£)', locale: 'en-GB' },
  INR: { code: 'INR', symbol: '₹', label: 'INR (₹)', locale: 'en-IN' },
  CAD: { code: 'CAD', symbol: 'C$', label: 'CAD (C$)', locale: 'en-CA' },
  AUD: { code: 'AUD', symbol: 'A$', label: 'AUD (A$)', locale: 'en-AU' },
}

export const DEFAULT_CURRENCY: CurrencyCode = 'USD'

const formatters = new Map<CurrencyCode, Intl.NumberFormat>()
export function getFormatter(code: CurrencyCode): Intl.NumberFormat {
  const existing = formatters.get(code)
  if (existing) return existing
  const c = CURRENCIES[code]
  const f = new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  formatters.set(code, f)
  return f
}
