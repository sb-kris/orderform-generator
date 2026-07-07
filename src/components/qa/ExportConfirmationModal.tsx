import { AlertCircle, AlertTriangle, FileCheck2 } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog'
import { Button } from '../ui/button'
import type { QaReport } from '@/lib/qa/documentQa'
import type { ExportMode } from '@/lib/exports/exportModes'
import type { OrderFormData } from '@/state/types'
import { buildDocModel } from '@/lib/docModel'
import { cn } from '@/lib/cn'

/**
 * Pre-export confirmation + summary. Shown before Final always, and before the
 * other modes when the QA report has open issues. It's the "deliberate export
 * moment": a snapshot of what's about to be generated plus any warnings, with
 * a clear path to fix issues, export anyway, or back out.
 */
export function ExportConfirmationModal({
  open,
  onOpenChange,
  mode,
  report,
  data,
  filename,
  exporting,
  onConfirm,
  onReviewIssues,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: ExportMode | null
  report: QaReport
  data: OrderFormData
  filename: string
  exporting: boolean
  onConfirm: () => void
  onReviewIssues: () => void
}) {
  if (!mode) return null
  const m = buildDocModel(data)
  const issues = [...report.errors, ...report.warnings]

  const summary: Array<{ label: string; value: string }> = [
    { label: 'Customer', value: m.customer.legalName || '—' },
    { label: 'Total', value: `${m.totalLabel} ${m.currencyCode}` },
    {
      label: 'Subscription',
      value: `${m.subscription.termMonths || '—'} mo · ${m.subscription.billingPeriod}`,
    },
    { label: 'PO required', value: m.po.required },
    { label: 'Export type', value: mode.label },
    { label: 'File', value: filename },
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="p-5">
          <div className="flex items-start gap-3">
            <div
              className={cn(
                'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
                report.errors.length
                  ? 'bg-rose-50 text-rose-600'
                  : report.warnings.length
                    ? 'bg-amber-50 text-amber-600'
                    : 'bg-teal-50 text-teal-600',
              )}
            >
              <FileCheck2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 pr-6">
              <DialogTitle>Export {mode.label}</DialogTitle>
              <DialogDescription className="mt-1">{mode.description}</DialogDescription>
            </div>
          </div>

          {/* Export preview summary */}
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2.5 rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
            {summary.map((s) => (
              <div key={s.label} className="min-w-0">
                <dt className="text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  {s.label}
                </dt>
                <dd className="truncate text-[12px] font-medium text-slate-900" title={s.value}>
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>

          {/* Issues */}
          {issues.length > 0 && (
            <div className="mt-4">
              <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
                {report.errors.length ? (
                  <AlertCircle className="h-4 w-4 text-rose-500" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                )}
                {issues.length} issue{issues.length === 1 ? '' : 's'} before export
                {report.ignored.length > 0 && (
                  <span className="font-normal text-slate-400">
                    · {report.ignored.length} acknowledged
                  </span>
                )}
              </div>
              <ul className="grid max-h-40 gap-1 overflow-y-auto">
                {issues.map((i) => (
                  <li
                    key={i.id}
                    className={cn(
                      'flex items-start gap-2 rounded-md px-2.5 py-1.5 text-[11.5px]',
                      i.status === 'error'
                        ? 'bg-rose-50/70 text-rose-900'
                        : 'bg-amber-50/60 text-amber-900',
                    )}
                  >
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
                    <span>
                      <span className="font-semibold">{i.section}:</span> {i.message}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-5 flex items-center justify-end gap-2">
            {issues.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onReviewIssues} disabled={exporting}>
                Review issues
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={exporting}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onConfirm}
              disabled={exporting}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {exporting ? 'Preparing…' : issues.length > 0 ? 'Export anyway' : `Export ${mode.kind}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
