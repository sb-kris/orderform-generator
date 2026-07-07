import { motion, AnimatePresence } from 'motion/react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

export function Collapsible({
  open,
  children,
  className,
}: {
  open: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className={cn('overflow-hidden', className)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function CollapseIcon({ open, className }: { open: boolean; className?: string }) {
  return (
    <ChevronDown
      className={cn(
        'h-4 w-4 text-slate-400 transition-transform duration-150',
        open ? 'rotate-180' : 'rotate-0',
        className,
      )}
    />
  )
}
