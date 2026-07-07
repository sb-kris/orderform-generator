import { cn } from '@/lib/cn'
import type { ReactNode } from 'react'

type Variant = 'success' | 'warning' | 'muted' | 'info'

const styles: Record<Variant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-800 border-amber-200',
  info: 'bg-sky-50 text-sky-700 border-sky-200',
  muted: 'bg-muted text-muted-foreground border-border',
}

export function StatusBadge({
  variant = 'muted',
  children,
  className,
}: {
  variant?: Variant
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium',
        styles[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
