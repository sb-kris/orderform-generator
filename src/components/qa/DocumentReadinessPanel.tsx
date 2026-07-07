import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  EyeOff,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import type { QaCheck, QaReport, ReadinessStatus } from '@/lib/qa/documentQa'
import { ReadinessScore } from './ReadinessScore'
import { useStore } from '@/state/store'
import { cn } from '@/lib/cn'

/** Status-toned top accent for the hero — brand teal ready, amber/rose by severity. */
const HERO_ACCENT: Record<ReadinessStatus, string> = {
  'needs-attention': 'bg-rose-500',
  'almost-ready': 'bg-amber-500',
  ready: 'bg-primary',
  'customer-ready': 'bg-primary',
}

/**
 * Top-of-form Document Readiness panel: the readiness score + status, then
 * every open issue grouped errors-first. Warnings can be acknowledged
 * ("Mark reviewed") — they move to a collapsible Reviewed area, stop counting
 * against the score, and can be restored. Clicking an issue triggers smart-fix
 * navigation (expand section → scroll → focus + flash the field).
 */
export function DocumentReadinessPanel({
  report,
  checked,
  onCheck,
  onFocusIssue,
}: {
  report: QaReport
  /** Whether a readiness check has been run — gates the full dashboard. */
  checked: boolean
  onCheck: () => void
  onFocusIssue: (sectionId: string, fieldId?: string) => void
}) {
  const { ignoreWarning, restoreWarning } = useStore()
  const [showReviewed, setShowReviewed] = useState(false)
  const issues = [...report.errors, ...report.warnings]

  // Calm draft state — shown before the user runs a readiness check, so a blank
  // or in-progress form is never greeted with a wall of critical errors.
  if (!checked) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-card">
        <div className="h-1 w-full bg-slate-200" aria-hidden />
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div
            className="grid h-16 w-16 shrink-0 place-items-center rounded-full border-2 border-dashed border-slate-300 text-slate-400"
            aria-hidden
          >
            <ClipboardCheck className="h-6 w-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Document readiness
            </div>
            <div className="mt-1 font-display text-[19px] font-bold text-slate-950">
              Draft in progress
            </div>
            <p className="mt-0.5 text-[13px] text-slate-500">
              Complete the sections below, then run a readiness check before export.
            </p>
          </div>
          <button
            type="button"
            onClick={onCheck}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-[14px] font-semibold text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-[0.98]"
          >
            <ShieldCheck className="h-4 w-4" /> Check readiness
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-card shadow-pop">
      {/* Status-toned accent hairline — the only colour cue at the top edge, calm
          not loud. Teal when ready; amber/rose by severity via existing tokens. */}
      <div className={cn('h-1 w-full', HERO_ACCENT[report.status])} aria-hidden />
      <div className="p-5">
        <div className="flex items-center gap-5">
          <ReadinessScore report={report} size={92} />
          <div className="ml-auto hidden items-center gap-5 sm:flex">
            <div className="h-12 w-px bg-slate-200" aria-hidden />
            <div className="text-right">
              <div className="font-display text-[32px] font-bold leading-none tabular-nums text-slate-950">
                {report.passes.length}
              </div>
              <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Checks passed
              </div>
            </div>
          </div>
        </div>

      <AnimatePresence mode="wait">
        {issues.length === 0 ? (
          <motion.div
            key="clean"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="mt-3 flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-[12px] text-teal-800"
          >
            {report.status === 'customer-ready' ? (
              <Sparkles className="h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 shrink-0" />
            )}
            <span>
              {report.status === 'customer-ready'
                ? 'Customer-ready. Every check passed — safe to send.'
                : 'Ready to generate. All required fields are complete.'}
            </span>
          </motion.div>
        ) : (
          <motion.ul
            key="issues"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.18 }}
            className="mt-3 grid gap-1.5"
          >
            {issues.map((issue) => (
              <IssueRow
                key={issue.id}
                issue={issue}
                onFocusIssue={onFocusIssue}
                onIgnore={() => ignoreWarning(issue.id, issue.dependencyKey)}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>

      {/* Reviewed / acknowledged warnings */}
      {report.ignored.length > 0 && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50/60">
          <button
            type="button"
            onClick={() => setShowReviewed((v) => !v)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-[11.5px] font-semibold text-slate-600"
          >
            {showReviewed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
            <EyeOff className="h-3.5 w-3.5 text-slate-400" />
            Reviewed warnings ({report.ignored.length})
            <span className="ml-auto text-[10px] font-normal text-slate-400">
              not counted in score
            </span>
          </button>
          <AnimatePresence initial={false}>
            {showReviewed && (
              <motion.ul
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="overflow-hidden px-2 pb-2"
              >
                {report.ignored.map((issue) => (
                  <li
                    key={issue.id}
                    className="flex items-start gap-2 rounded-md px-2 py-1.5 text-[11.5px] text-slate-500"
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                    <span className="min-w-0 flex-1">
                      <span className="font-semibold text-slate-600">{issue.section}:</span>{' '}
                      <span className="line-through decoration-slate-300">{issue.message}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => restoreWarning(issue.id)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold text-teal-700 hover:bg-teal-50"
                    >
                      <RotateCcw className="h-3 w-3" /> Restore
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
      </div>
    </div>
  )
}

function IssueRow({
  issue,
  onFocusIssue,
  onIgnore,
}: {
  issue: QaCheck
  onFocusIssue: (sectionId: string, fieldId?: string) => void
  onIgnore: () => void
}) {
  const isError = issue.status === 'error'
  return (
    <li
      className={cn(
        'group flex items-start gap-2.5 rounded-lg border px-3 py-2 transition-colors',
        isError
          ? 'border-rose-200/70 bg-rose-50/40 hover:bg-rose-50/70'
          : 'border-amber-200/70 bg-amber-50/30 hover:bg-amber-50/60',
      )}
    >
      {isError ? (
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
      ) : (
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      )}
      <button
        type="button"
        onClick={() => onFocusIssue(issue.sectionId, issue.fieldId)}
        className="min-w-0 flex-1 text-left"
      >
        <span className="flex items-center gap-1.5">
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide',
              isError ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800',
            )}
          >
            {issue.section}
          </span>
        </span>
        <span
          className={cn(
            'mt-1 block text-[12px] font-medium',
            isError ? 'text-rose-900' : 'text-amber-900',
          )}
        >
          {issue.message}
        </span>
        {issue.suggestedFix && (
          <span className="mt-0.5 block text-[11px] text-slate-500">{issue.suggestedFix}</span>
        )}
      </button>
      {issue.canIgnore ? (
        <button
          type="button"
          onClick={onIgnore}
          title="Acknowledge — stops counting against the readiness score"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-200 bg-card px-2 py-1 text-[10.5px] font-semibold text-slate-600 shadow-xs hover:border-slate-300 hover:text-slate-900"
        >
          <EyeOff className="h-3 w-3" /> Mark reviewed
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onFocusIssue(issue.sectionId, issue.fieldId)}
          className="self-center"
          aria-label="Go to field"
        >
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-slate-500" />
        </button>
      )}
    </li>
  )
}
