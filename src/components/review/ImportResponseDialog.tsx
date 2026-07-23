import { useRef } from 'react'
import { FileJson, FileText } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '../ui/dialog'

/**
 * Upload chooser for "Import Response". Offers the two things Sales might have:
 * a portable Quill draft file, or a customer-returned Fillable PDF. Both options
 * hand the chosen File back to the parent, which routes by type (a PDF picked
 * under either option still works).
 */
export function ImportResponseDialog({
  open,
  onOpenChange,
  onFile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFile: (file: File) => void
}) {
  const draftInput = useRef<HTMLInputElement>(null)
  const pdfInput = useRef<HTMLInputElement>(null)

  const pick = (file: File | undefined | null) => {
    if (!file) return
    onOpenChange(false)
    onFile(file)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="p-6">
          <DialogTitle className="pr-6">Import Draft or Customer Response</DialogTitle>
          <DialogDescription className="mt-1.5 leading-relaxed">
            Bring work back into Quill — either a draft you exported, or a fillable order form a
            customer filled in and returned.
          </DialogDescription>

          <div className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={() => draftInput.current?.click()}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <FileJson className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-900">
                  Upload Quill draft file
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                  Use a <code className="text-slate-600">.quill.json</code> file exported from this
                  app.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => pdfInput.current?.click()}
              className="flex items-start gap-3 rounded-xl border border-slate-200 p-3.5 text-left transition-colors hover:border-teal-300 hover:bg-teal-50/40"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <FileText className="h-[18px] w-[18px]" />
              </span>
              <span className="min-w-0">
                <span className="block text-[13.5px] font-semibold text-slate-900">
                  Upload filled PDF
                </span>
                <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">
                  Use a customer-returned fillable order form PDF. Quill reads the fields it
                  recognises and shows you what changed before anything is applied.
                </span>
              </span>
            </button>
          </div>

          <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-[11.5px] leading-snug text-slate-500">
            <strong className="font-semibold text-slate-600">Save Locally</strong> stores the draft
            in this browser. <strong className="font-semibold text-slate-600">Export Draft</strong>{' '}
            creates a portable file you can keep or share internally.
          </p>

          <input
            ref={draftInput}
            type="file"
            accept=".json,.quill.json,application/json"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <input
            ref={pdfInput}
            type="file"
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={(e) => {
              pick(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
