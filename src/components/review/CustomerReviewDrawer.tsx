import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Info, MessageSquareQuote, Undo2, X } from 'lucide-react'
import { Button } from '../ui/button'
import { cn } from '@/lib/cn'
import type { ReviewGroup, ReviewItem, ReviewStatus } from '@/lib/exports/pdfReadback'

type Resolution = 'applied' | 'ignored'

const STATUS_STYLE: Record<ReviewStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'border-teal-200 bg-teal-50 text-teal-700' },
  changed: { label: 'Changed', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  same: { label: 'Same', cls: 'border-slate-200 bg-slate-50 text-slate-500' },
  empty: { label: 'Empty', cls: 'border-slate-200 bg-slate-50 text-slate-400' },
}

export function CustomerReviewDrawer({
  open,
  groups,
  sourceName,
  onOpenChange,
  onApply,
  onApplyAllSafe,
}: {
  open: boolean
  groups: ReviewGroup[]
  /** Filename of the uploaded PDF, shown in the subtitle. */
  sourceName?: string
  onOpenChange: (open: boolean) => void
  onApply: (item: ReviewItem) => void
  onApplyAllSafe: (items: ReviewItem[]) => void
}) {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({})

  const allItems = groups.flatMap((g) => g.items)
  const safeItems = allItems.filter((i) => i.safe && !resolved[i.id])
  const pending = allItems.filter((i) => !resolved[i.id])

  const resolve = (id: string, r: Resolution) => setResolved((prev) => ({ ...prev, [id]: r }))

  const applyOne = (item: ReviewItem) => {
    onApply(item)
    resolve(item.id, 'applied')
  }
  const applyAllSafe = () => {
    if (!safeItems.length) return
    onApplyAllSafe(safeItems)
    setResolved((prev) => {
      const next = { ...prev }
      safeItems.forEach((i) => (next[i.id] = 'applied'))
      return next
    })
  }
  const ignoreAll = () => {
    setResolved((prev) => {
      const next = { ...prev }
      pending.forEach((i) => (next[i.id] = 'ignored'))
      return next
    })
  }

  const close = () => {
    onOpenChange(false)
    // Reset resolutions for the next import after the exit animation.
    setTimeout(() => setResolved({}), 250)
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-50 bg-slate-950/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            aria-hidden
          />
          <motion.aside
            role="dialog"
            aria-label="Customer Review Received"
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[460px] flex-col border-l border-slate-200 bg-card shadow-pop"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          >
            {/* Header */}
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-display text-[17px] font-bold text-slate-950">
                    Customer Review Received
                  </h2>
                  <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                    Review the values returned in the uploaded PDF before applying them to the
                    order form.
                  </p>
                  {sourceName && (
                    <p className="mt-1 truncate text-[11px] text-slate-400" title={sourceName}>
                      {sourceName}
                    </p>
                  )}
                </div>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={close}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button size="sm" onClick={applyAllSafe} disabled={safeItems.length === 0}>
                  <Check className="h-3.5 w-3.5" /> Apply all safe changes
                  {safeItems.length > 0 && (
                    <span className="ml-0.5 tabular-nums opacity-80">({safeItems.length})</span>
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={ignoreAll} disabled={pending.length === 0}>
                  Ignore all
                </Button>
                <Button variant="ghost" size="sm" onClick={close} className="ml-auto">
                  Close
                </Button>
              </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {groups.length === 0 ? (
                <p className="text-[13px] text-slate-500">
                  No recognizable order-form fields were found in this PDF.
                </p>
              ) : (
                <div className="space-y-6">
                  {groups.map((group) => (
                    <section key={group.section}>
                      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                        {group.label}
                      </h3>
                      {group.section === 'signature' && (
                        <div className="mb-2 flex items-start gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] leading-snug text-slate-500">
                          <Info className="mt-0.5 h-3 w-3 shrink-0" />
                          <span>
                            A hand-drawn or uploaded signature image can’t be imported
                            automatically — open the PDF to review it manually.
                          </span>
                        </div>
                      )}
                      <div className="space-y-2">
                        {group.items.map((item) =>
                          item.kind === 'comment' ? (
                            <CommentCard
                              key={item.id}
                              item={item}
                              resolution={resolved[item.id]}
                              onApply={() => applyOne(item)}
                              onIgnore={() => resolve(item.id, 'ignored')}
                            />
                          ) : (
                            <FieldRow
                              key={item.id}
                              item={item}
                              resolution={resolved[item.id]}
                              onApply={() => applyOne(item)}
                              onIgnore={() => resolve(item.id, 'ignored')}
                            />
                          ),
                        )}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-3">
              <p className="text-[11px] leading-snug text-slate-400">
                Applying updates the builder and live preview. Regenerate the Final PDF after
                you’ve accepted the changes you want.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function StatusBadge({ status }: { status: ReviewStatus }) {
  const s = STATUS_STYLE[status]
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
        s.cls,
      )}
    >
      {s.label}
    </span>
  )
}

function ResolutionChip({ resolution }: { resolution: Resolution }) {
  return resolution === 'applied' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
      <Check className="h-3 w-3" /> Applied
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
      <Undo2 className="h-3 w-3" /> Ignored
    </span>
  )
}

function Actions({
  item,
  resolution,
  onApply,
  onIgnore,
  applyLabel = 'Apply',
  ignoreLabel = 'Ignore',
}: {
  item: ReviewItem
  resolution?: Resolution
  onApply: () => void
  onIgnore: () => void
  applyLabel?: string
  ignoreLabel?: string
}) {
  if (resolution) return <ResolutionChip resolution={resolution} />
  const applyDisabled = !item.appliable || item.status === 'same'
  return (
    <div className="flex items-center gap-1.5">
      <Button size="sm" onClick={onApply} disabled={applyDisabled} className="h-7 px-2.5 text-[12px]">
        {applyLabel}
      </Button>
      <Button variant="ghost" size="sm" onClick={onIgnore} className="h-7 px-2 text-[12px]">
        {ignoreLabel}
      </Button>
    </div>
  )
}

function FieldRow({
  item,
  resolution,
  onApply,
  onIgnore,
}: {
  item: ReviewItem
  resolution?: Resolution
  onApply: () => void
  onIgnore: () => void
}) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-slate-900">{item.label}</span>
          <StatusBadge status={item.status} />
        </div>
        <Actions item={item} resolution={resolution} onApply={onApply} onIgnore={onIgnore} />
      </div>
      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        <span className="text-slate-400">Current</span>
        <span className="text-slate-700">{item.currentDisplay || <em className="text-slate-300">blank</em>}</span>
        <span className="text-slate-400">Returned</span>
        <span className="font-medium text-slate-900">
          {item.returnedDisplay || <em className="text-slate-300">blank</em>}
        </span>
      </div>
      {item.note && <p className="mt-1.5 text-[11px] text-amber-700">{item.note}</p>}
    </div>
  )
}

function CommentCard({
  item,
  resolution,
  onApply,
  onIgnore,
}: {
  item: ReviewItem
  resolution?: Resolution
  onApply: () => void
  onIgnore: () => void
}) {
  const hasReturned = !!item.returnedDisplay
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-teal-700" />
          <span className="text-[12px] font-semibold text-teal-800">{item.label}</span>
          <StatusBadge status={item.status} />
        </div>
        <Actions
          item={item}
          resolution={resolution}
          onApply={onApply}
          onIgnore={onIgnore}
          applyLabel="Apply to draft"
          ignoreLabel="Keep separate"
        />
      </div>
      {hasReturned ? (
        <blockquote className="mt-2 border-l-2 border-teal-300 pl-2.5 text-[12.5px] italic leading-snug text-slate-800">
          “{item.returnedDisplay}”
        </blockquote>
      ) : (
        <p className="mt-2 text-[12px] text-slate-400">No comment was returned in this field.</p>
      )}
      {item.currentDisplay && item.status === 'changed' && (
        <p className="mt-2 text-[11px] text-slate-500">
          Current draft comment: <span className="text-slate-700">“{item.currentDisplay}”</span>
        </p>
      )}
    </div>
  )
}
