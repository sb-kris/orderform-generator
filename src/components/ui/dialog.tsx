import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { motion } from 'motion/react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger

/**
 * Centered modal dialog. Radix handles focus trap, escape, and scroll lock;
 * Motion adds a restrained fade/scale. Content is width-capped and scrolls
 * internally so tall summaries never push the page.
 */
export function DialogContent({
  children,
  className,
  onOpenAutoFocus,
}: {
  children: ReactNode
  className?: string
  onOpenAutoFocus?: (e: Event) => void
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out" />
      <DialogPrimitive.Content
        onOpenAutoFocus={onOpenAutoFocus}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-[min(94vw,560px)] -translate-x-1/2 -translate-y-1/2 focus:outline-none',
          className,
        )}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.16, ease: 'easeOut' }}
          className="max-h-[86vh] overflow-y-auto rounded-2xl border border-slate-200 bg-card shadow-pop"
        >
          {children}
          <DialogPrimitive.Close
            className="absolute right-3.5 top-3.5 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </DialogPrimitive.Close>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <DialogPrimitive.Title
      className={cn('font-display text-lg font-bold text-slate-950', className)}
    >
      {children}
    </DialogPrimitive.Title>
  )
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <DialogPrimitive.Description className={cn('text-[12px] text-slate-500', className)}>
      {children}
    </DialogPrimitive.Description>
  )
}
