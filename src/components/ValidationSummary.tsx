import { AnimatePresence, motion } from 'motion/react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ValidationIssue } from '@/state/validation'
import { SECTIONS } from './SectionNavigation'

export function ValidationSummary({
  issues,
  onGoto,
}: {
  issues: ValidationIssue[]
  onGoto: (id: string) => void
}) {
  return (
    <AnimatePresence mode="wait">
      {issues.length === 0 ? (
        <motion.div
          key="ok"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="flex items-center gap-2 rounded-lg border border-teal-200 bg-teal-50 px-3.5 py-2.5 text-[12px] text-teal-800"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span>Ready to generate. All required fields are filled.</span>
        </motion.div>
      ) : (
        <motion.div
          key="issues"
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-[12px] text-amber-900"
        >
          <div className="mb-2 flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            {issues.length} item{issues.length === 1 ? '' : 's'} need attention before
            generating the Final PDF
          </div>
          <ul className="grid gap-1">
            {issues.slice(0, 8).map((issue, i) => {
              const section = SECTIONS.find((s) => s.id === issue.sectionId)
              return (
                <li key={issue.path + i}>
                  <button
                    type="button"
                    onClick={() => onGoto(issue.sectionId)}
                    className="text-left underline-offset-2 hover:underline"
                  >
                    <span className="font-semibold">{section?.label ?? 'Section'}:</span>{' '}
                    {issue.message}
                  </button>
                </li>
              )
            })}
            {issues.length > 8 && (
              <li className="text-amber-800/70">…and {issues.length - 8} more.</li>
            )}
          </ul>
          <p className="mt-2 text-[11px] text-amber-800/80">
            Drafts can still be saved even if some fields are incomplete.
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
