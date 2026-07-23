import { getFormatter, type CurrencyCode } from './currency'

export function formatCurrency(
  value: number | string | null | undefined,
  code: CurrencyCode = 'USD',
): string {
  const n = typeof value === 'number' ? value : Number(value)
  const f = getFormatter(code)
  if (!Number.isFinite(n)) return f.format(0)
  return f.format(n)
}

/**
 * Quantity with an optional display-only unit appended: "50 GB", "1000 EMAILS",
 * or just "10" when no unit. Unit is trimmed; casing preserved; no double
 * spaces. Blank quantity yields an empty string. Never used in calculations.
 */
export function formatQuantityWithUnit(
  quantity: number | string,
  unit?: string | null,
): string {
  const q = (typeof quantity === 'number' ? String(quantity) : String(quantity ?? '')).trim()
  if (!q) return ''
  const u = (unit ?? '').trim()
  return u ? `${q} ${u}` : q
}

export function parseNumber(v: string): number {
  if (!v) return 0
  const n = Number(v.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso ?? ''
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })
}
