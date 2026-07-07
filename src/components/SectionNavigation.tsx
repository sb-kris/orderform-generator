import { motion } from 'motion/react'
import { cn } from '@/lib/cn'
import type { ValidationIssue } from '@/state/validation'
import { ChevronsLeft, ChevronsRight } from 'lucide-react'

export type SectionMeta = {
  id: string
  label: string
  short: string
}

export const SECTIONS: SectionMeta[] = [
  { id: 'customer', label: 'Customer Information', short: '01' },
  { id: 'soldTo', label: 'Sold To', short: '02' },
  { id: 'services', label: 'Services', short: '03' },
  { id: 'billing', label: 'Billing & Shipping', short: '04' },
  { id: 'subscription', label: 'Subscription Details', short: '05' },
  { id: 'terms', label: 'Terms & Conditions', short: '06' },
  { id: 'signature', label: 'Execution / Signature', short: '07' },
  { id: 'purchaseOrder', label: 'Purchase Order', short: '08' },
]

export function SectionNavigation({
  activeId,
  onSelect,
  issues,
  collapsed,
  onToggleCollapsed,
}: {
  activeId: string
  onSelect: (id: string) => void
  issues: ValidationIssue[]
  collapsed: boolean
  onToggleCollapsed: () => void
}) {
  const issueCount = (id: string) => issues.filter((i) => i.sectionId === id).length

  return (
    <nav aria-label="Order form sections" className="flex flex-col gap-1">
      <div className="mb-2 flex items-center justify-between px-1">
        {!collapsed && (
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Sections
          </div>
        )}
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="ml-auto rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" />
          ) : (
            <ChevronsLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      {SECTIONS.map((s) => {
        const count = issueCount(s.id)
        const isActive = activeId === s.id
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            title={s.label}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-2 py-2 text-left text-sm transition-colors',
              isActive
                ? 'bg-teal-50 font-medium text-teal-800'
                : 'text-slate-700 hover:bg-slate-100',
              collapsed && 'justify-center px-0',
            )}
          >
            {isActive && !collapsed && (
              <span
                className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary"
                aria-hidden
              />
            )}
            <span
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold tabular-nums',
                isActive
                  ? 'bg-teal-400 text-white'
                  : count > 0
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-slate-100 text-slate-500',
              )}
            >
              {s.short}
            </span>
            {!collapsed && (
              <>
                <span className="min-w-0 flex-1 truncate">{s.label}</span>
                {count > 0 && (
                  <motion.span
                    layout
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-flex h-5 min-w-[20px] items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800 ring-1 ring-amber-200"
                  >
                    {count}
                  </motion.span>
                )}
              </>
            )}
          </button>
        )
      })}
    </nav>
  )
}
