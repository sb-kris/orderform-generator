import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useStore } from '@/state/store'
import { Collapsible, CollapseIcon } from '../ui/collapsible'
import { Button } from '../ui/button'

export function Section({
  id,
  number,
  title,
  description,
  children,
  actions,
  errorCount = 0,
  complete = false,
}: {
  id: string
  number: string
  title: string
  description?: string
  children: ReactNode
  actions?: ReactNode
  errorCount?: number
  complete?: boolean
}) {
  const { layout, toggleSectionCollapsed } = useStore()
  const collapsed = layout.collapsedSections.includes(id)
  const open = !collapsed

  return (
    <motion.section
      id={id}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-card shadow-xs"
    >
      <div className="flex w-full items-center gap-4 px-5 py-4">
        <button
          type="button"
          onClick={() => toggleSectionCollapsed(id)}
          aria-expanded={open}
          aria-controls={`${id}-body`}
          className="flex min-w-0 flex-1 items-center gap-4 text-left"
        >
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums',
              errorCount > 0
                ? 'bg-amber-100 text-amber-800'
                : complete
                  ? 'bg-teal-400 text-white'
                  : 'bg-slate-100 text-slate-500',
            )}
          >
            {number}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-[17px] font-bold text-slate-950">
                {title}
              </h2>
              {complete && errorCount === 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
                  <Check className="h-3 w-3" /> Complete
                </span>
              )}
              {errorCount > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                  <AlertTriangle className="h-3 w-3" /> {errorCount}{' '}
                  {errorCount === 1 ? 'issue' : 'issues'}
                </span>
              )}
            </div>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            )}
          </div>
        </button>
        <div className="flex items-center gap-1">
          {actions}
          <Button
            variant="ghost"
            size="icon"
            aria-label={open ? 'Collapse' : 'Expand'}
            onClick={() => toggleSectionCollapsed(id)}
          >
            <CollapseIcon open={open} />
          </Button>
        </div>
      </div>
      <Collapsible open={open}>
        <div id={`${id}-body`} className="grid gap-4 border-t border-slate-100 px-5 py-5">
          {children}
        </div>
      </Collapsible>
    </motion.section>
  )
}

export function Field({
  label,
  htmlFor,
  required,
  children,
  className,
  hint,
}: {
  label: string
  htmlFor?: string
  required?: boolean
  children: ReactNode
  className?: string
  hint?: string
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <label
        htmlFor={htmlFor}
        className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500"
      >
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </label>
      {children}
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  )
}
