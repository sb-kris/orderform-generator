import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, Check, Info, MessageSquareQuote, Undo2, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { cn } from '@/lib/cn'
import {
  summarizeReview,
  type ReviewGroup,
  type ReviewItem,
  type ReviewStatus,
} from '@/lib/exports/pdfReadback'

type Resolution = 'applied' | 'ignored'

const STATUS_STYLE: Record<ReviewStatus, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'border-teal-200 bg-teal-50 text-teal-700' },
  changed: { label: 'Changed', cls: 'border-amber-200 bg-amber-50 text-amber-800' },
  cleared: { label: 'Cleared', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
  same: { label: 'Same', cls: 'border-slate-200 bg-slate-50 text-slate-500' },
  empty: { label: 'Empty', cls: 'border-slate-200 bg-slate-50 text-slate-400' },
  'not-returned': { label: 'Not returned', cls: 'border-slate-200 bg-slate-50 text-slate-400' },
  'needs-correction': { label: 'Needs correction', cls: 'border-amber-300 bg-amber-50 text-amber-800' },
}

/** Rows that carry a real action (everything else is quiet / hidden). */
const isActionable = (i: ReviewItem) =>
  i.status === 'new' ||
  i.status === 'changed' ||
  i.status === 'cleared' ||
  i.status === 'needs-correction'

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
  sourceName?: string
  onOpenChange: (open: boolean) => void
  onApply: (item: ReviewItem, override?: string) => void
  onApplyAllSafe: (items: ReviewItem[]) => void
}) {
  const [resolved, setResolved] = useState<Record<string, Resolution>>({})
  const [corrections, setCorrections] = useState<Record<string, string>>({})

  const allItems = groups.flatMap((g) => g.items)
  const summary = summarizeReview(groups)
  const safeItems = allItems.filter((i) => i.safe && !resolved[i.id])
  const pending = allItems.filter((i) => isActionable(i) && !resolved[i.id])

  const resolve = (id: string, r: Resolution) => setResolved((prev) => ({ ...prev, [id]: r }))

  const applyOne = (item: ReviewItem, override?: string) => {
    onApply(item, override)
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
  const ignoreAll = () =>
    setResolved((prev) => {
      const next = { ...prev }
      pending.forEach((i) => (next[i.id] = 'ignored'))
      return next
    })

  const close = () => {
    onOpenChange(false)
    setTimeout(() => {
      setResolved({})
      setCorrections({})
    }, 250)
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
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[480px] flex-col border-l border-slate-200 bg-card shadow-pop"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'tween', duration: 0.22, ease: 'easeOut' }}
          >
            {/* Header + summary */}
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
                </div>
                <Button variant="ghost" size="icon" aria-label="Close" onClick={close}>
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {sourceName && (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                    Imported from
                  </div>
                  <div className="truncate text-[11.5px] text-slate-700" title={sourceName}>
                    {sourceName}
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <SummaryPill n={summary.comments} label="customer comment" tone="teal" />
                    <SummaryPill n={summary.newCount} label="new value" tone="teal" />
                    <SummaryPill n={summary.changed} label="changed field" tone="amber" />
                    <SummaryPill n={summary.cleared} label="cleared field" tone="rose" />
                    <SummaryPill n={summary.needsCorrection} label="needs correction" tone="amber" />
                    <SummaryPill n={summary.unchanged} label="unchanged field" tone="slate" />
                  </div>
                </div>
              )}

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
                    <GroupSection
                      key={group.section}
                      group={group}
                      resolved={resolved}
                      corrections={corrections}
                      setCorrection={(id, v) => setCorrections((p) => ({ ...p, [id]: v }))}
                      onApply={applyOne}
                      onIgnore={(id) => resolve(id, 'ignored')}
                    />
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-200 px-5 py-3">
              <p className="text-[11px] leading-snug text-slate-400">
                Applying updates the builder, live preview, and readiness. Regenerate the Final PDF
                after you’ve accepted the changes you want.
              </p>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function GroupSection({
  group,
  resolved,
  corrections,
  setCorrection,
  onApply,
  onIgnore,
}: {
  group: ReviewGroup
  resolved: Record<string, Resolution>
  corrections: Record<string, string>
  setCorrection: (id: string, v: string) => void
  onApply: (item: ReviewItem, override?: string) => void
  onIgnore: (id: string) => void
}) {
  const isComments = group.section === 'comments'
  const isSignature = group.section === 'signature'

  // Comments: show every comment that has content (incl. "same" → Already applied).
  const commentItems = group.items.filter((i) => i.kind === 'comment' && !!i.returnedDisplay)
  const actionable = group.items.filter(isActionable)
  const quietCount = group.items.length - actionable.length

  if (isComments) {
    if (commentItems.length === 0) return null
    return (
      <section>
        <Heading>{group.label}</Heading>
        <div className="space-y-2">
          {commentItems.map((item) => (
            <CommentCard
              key={item.id}
              item={item}
              resolution={resolved[item.id]}
              onApply={() => onApply(item)}
              onIgnore={() => onIgnore(item.id)}
            />
          ))}
        </div>
      </section>
    )
  }

  if (isSignature && actionable.length === 0) {
    // Collapse a fully-blank signature block into one info card.
    return (
      <section>
        <Heading>{group.label}</Heading>
        <div className="flex items-start gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11.5px] leading-snug text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            No customer signature details were returned. Review the uploaded PDF manually if the
            customer signed visually.
          </span>
        </div>
      </section>
    )
  }

  if (actionable.length === 0) return null // nothing to act on in this group — hide it

  return (
    <section>
      <Heading>{group.label}</Heading>
      <div className="space-y-2">
        {actionable.map((item) => (
          <FieldRow
            key={item.id}
            item={item}
            resolution={resolved[item.id]}
            correction={corrections[item.id]}
            setCorrection={(v) => setCorrection(item.id, v)}
            onApply={onApply}
            onIgnore={() => onIgnore(item.id)}
          />
        ))}
      </div>
      {quietCount > 0 && (
        <p className="mt-2 text-[11px] text-slate-400">
          {quietCount} unchanged field{quietCount === 1 ? '' : 's'} hidden.
        </p>
      )}
    </section>
  )
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">
      {children}
    </h3>
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

function FieldRow({
  item,
  resolution,
  correction,
  setCorrection,
  onApply,
  onIgnore,
}: {
  item: ReviewItem
  resolution?: Resolution
  correction?: string
  setCorrection: (v: string) => void
  onApply: (item: ReviewItem, override?: string) => void
  onIgnore: () => void
}) {
  const needsDateInput =
    item.kind === 'date' && (item.parseStatus === 'ambiguous' || item.status === 'needs-correction')
  const dateValue = correction ?? (item.parseStatus === 'ambiguous' ? item.normalizedValue ?? '' : '')

  const cleared = item.status === 'cleared'
  const applyLabel = cleared ? 'Clear field' : item.status === 'needs-correction' ? 'Apply corrected' : 'Apply'
  const keepLabel = item.status === 'new' ? 'Ignore' : 'Keep current'
  const canApply =
    item.status === 'needs-correction' ? !!dateValue : cleared ? true : item.appliable

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[12.5px] font-semibold text-slate-900">{item.label}</span>
          <StatusBadge status={item.status} />
        </div>
        {resolution ? (
          <ResolutionChip resolution={resolution} />
        ) : (
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={() => onApply(item, needsDateInput ? dateValue : undefined)}
              disabled={!canApply}
              className={cn('h-7 px-2.5 text-[12px]', cleared && 'bg-rose-600 hover:bg-rose-600/90')}
            >
              {applyLabel}
            </Button>
            <Button variant="ghost" size="sm" onClick={onIgnore} className="h-7 px-2 text-[12px]">
              {keepLabel}
            </Button>
          </div>
        )}
      </div>

      <div className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        <span className="text-slate-400">Current</span>
        <span className="text-slate-700">
          {item.currentDisplay || <em className="text-slate-300">blank</em>}
        </span>
        <span className="text-slate-400">Returned</span>
        <span className={cn('font-medium', cleared ? 'text-rose-600' : 'text-slate-900')}>
          {cleared ? 'cleared (blank)' : item.returnedDisplay || <em className="text-slate-300">blank</em>}
        </span>
        {item.kind === 'date' && item.interpretedDisplay && item.parseStatus !== 'failed' && (
          <>
            <span className="text-slate-400">Interpreted</span>
            <span className="text-slate-700">
              {item.interpretedDisplay}
              {item.ambiguousAltDisplay && (
                <span className="text-slate-400"> · or {item.ambiguousAltDisplay}</span>
              )}
            </span>
          </>
        )}
      </div>

      {item.note && (
        <p className="mt-1.5 flex items-start gap-1 text-[11px] text-amber-700">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{item.note}</span>
        </p>
      )}

      {needsDateInput && !resolution && (
        <div className="mt-2">
          <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {item.status === 'needs-correction' ? 'Enter corrected date' : 'Confirm date'}
          </label>
          <Input
            type="date"
            value={dateValue}
            onChange={(e) => setCorrection(e.target.value)}
            className="mt-1 h-8"
          />
        </div>
      )}
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
  const alreadyApplied = item.status === 'same'
  return (
    <div className="rounded-lg border border-teal-200 bg-teal-50/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <MessageSquareQuote className="h-3.5 w-3.5 text-teal-700" />
          <span className="text-[12px] font-semibold text-teal-800">{item.label}</span>
        </div>
        {resolution ? (
          <ResolutionChip resolution={resolution} />
        ) : alreadyApplied ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2 py-0.5 text-[10px] font-semibold text-teal-700">
            <Check className="h-3 w-3" /> Already applied
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={onApply} className="h-7 px-2.5 text-[12px]">
              Apply to draft
            </Button>
            <Button variant="ghost" size="sm" onClick={onIgnore} className="h-7 px-2 text-[12px]">
              Keep separate
            </Button>
          </div>
        )}
      </div>
      <blockquote className="mt-2 border-l-2 border-teal-300 pl-2.5 text-[12.5px] italic leading-snug text-slate-800">
        “{item.returnedDisplay}”
      </blockquote>
      {!alreadyApplied && item.currentDisplay && (
        <p className="mt-2 text-[11px] text-slate-500">
          Current draft comment: <span className="text-slate-700">“{item.currentDisplay}”</span>
        </p>
      )}
    </div>
  )
}

function SummaryPill({
  n,
  label,
  tone,
}: {
  n: number
  label: string
  tone: 'teal' | 'amber' | 'rose' | 'slate'
}) {
  if (!n) return null
  const cls = {
    teal: 'bg-teal-100 text-teal-800',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-700',
    slate: 'bg-slate-200 text-slate-600',
  }[tone]
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium', cls)}>
      {n} {label}
      {n === 1 ? '' : 's'}
    </span>
  )
}
