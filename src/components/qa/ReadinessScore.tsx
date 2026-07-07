import { motion } from 'motion/react'
import type { QaReport, ReadinessStatus } from '@/lib/qa/documentQa'
import { cn } from '@/lib/cn'

/** Visual treatment per readiness status. */
const TONE: Record<
  ReadinessStatus,
  { ring: string; text: string; chipBg: string; chipText: string }
> = {
  'needs-attention': {
    ring: 'stroke-rose-500',
    text: 'text-rose-600',
    chipBg: 'bg-rose-50 border-rose-200',
    chipText: 'text-rose-700',
  },
  'almost-ready': {
    ring: 'stroke-amber-500',
    text: 'text-amber-600',
    chipBg: 'bg-amber-50 border-amber-200',
    chipText: 'text-amber-800',
  },
  ready: {
    ring: 'stroke-teal-500',
    text: 'text-teal-600',
    chipBg: 'bg-teal-50 border-teal-200',
    chipText: 'text-teal-800',
  },
  'customer-ready': {
    ring: 'stroke-teal-500',
    text: 'text-teal-600',
    chipBg: 'bg-teal-50 border-teal-200',
    chipText: 'text-teal-800',
  },
}

export function ReadinessScore({ report, size = 68 }: { report: QaReport; size?: number }) {
  const tone = TONE[report.status]
  const hero = size >= 84
  const stroke = hero ? 7 : 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const dash = (report.score / 100) * c

  return (
    <div className={cn('flex items-center', hero ? 'gap-4' : 'gap-3')}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-slate-200"
          />
          <motion.circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            className={tone.ring}
            initial={{ strokeDasharray: `0 ${c}` }}
            animate={{ strokeDasharray: `${dash} ${c}` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
          {/* Tenon display face carries the score — the product's headline number. */}
          <span
            className={cn('font-display font-bold tabular-nums leading-none', tone.text)}
            style={{ fontSize: Math.round(size * 0.32) }}
          >
            {report.score}
          </span>
          <span
            className="font-semibold uppercase tracking-wide text-slate-400"
            style={{ fontSize: Math.max(8, Math.round(size * 0.11)) }}
          >
            / 100
          </span>
        </div>
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Readiness
        </div>
        <div
          className={cn(
            'mt-1 inline-flex items-center rounded-full border font-semibold',
            hero ? 'px-3 py-1 text-[13px]' : 'px-2.5 py-0.5 text-[12px]',
            tone.chipBg,
            tone.chipText,
          )}
        >
          {report.statusLabel}
        </div>
        <div className={cn('mt-1.5 text-slate-500', hero ? 'text-[12px]' : 'text-[11px]')}>
          {report.errors.length > 0 && (
            <span className="text-rose-600">{report.errors.length} critical</span>
          )}
          {report.errors.length > 0 && report.warnings.length > 0 && ' · '}
          {report.warnings.length > 0 && (
            <span className="text-amber-600">
              {report.warnings.length} warning{report.warnings.length === 1 ? '' : 's'}
            </span>
          )}
          {report.issueCount === 0 && <span className="text-teal-600">All checks passed</span>}
        </div>
      </div>
    </div>
  )
}
