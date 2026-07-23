import { motion, AnimatePresence } from 'motion/react'
import {
  Download,
  FileDown,
  FileClock,
  FileJson,
  FileInput,
  FolderOpen,
  RotateCcw,
  Save,
  FileType,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Sparkles,
  MoreHorizontal,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { ExportConfirmationModal } from './qa/ExportConfirmationModal'
import { ImportResponseDialog } from './review/ImportResponseDialog'
import { CustomerReviewDrawer } from './review/CustomerReviewDrawer'
import { useStore, clearDraft } from '@/state/store'
import type { OrderFormData } from '@/state/types'
import type { QaReport, ReadinessStatus } from '@/lib/qa/documentQa'
import {
  EXPORT_MODES,
  getExportDecision,
  type ExportMode,
  type ExportModeId,
} from '@/lib/exports/exportModes'
import { buildExportFileName } from '@/lib/exports/fileNaming'
import { serializeDraftFile, draftFileName, parseDraftFile } from '@/lib/exports/draftFile'
import {
  readPdfFields,
  buildReviewModel,
  applyReviewItem,
  type ReviewGroup,
  type ReviewItem,
} from '@/lib/exports/pdfReadback'
import { cn } from '@/lib/cn'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'

type Toast = { id: number; text: string; variant: 'success' | 'warning' | 'info' }

export function StickyToolbar({
  report,
  checked,
  onFocusIssue,
}: {
  report: QaReport
  /** Whether the readiness dashboard is active (a check has been run). */
  checked: boolean
  onFocusIssue: (sectionId: string, fieldId?: string) => void
}) {
  const {
    data,
    update,
    importData,
    saveDraft,
    loadDraft,
    reset,
    saveStatus,
    lastSavedAt,
    recordExport,
    runReadinessCheck,
  } = useStore()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [downloading, setDownloading] = useState<ExportModeId | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

  // Import / customer-review workflow state.
  const [importOpen, setImportOpen] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewGroups, setReviewGroups] = useState<ReviewGroup[]>([])
  const [reviewSource, setReviewSource] = useState<string>('')

  // Confirmation modal state.
  const [pendingMode, setPendingMode] = useState<ExportMode | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  // Re-render every 30s so the "last saved" relative time stays fresh.
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])
  const savedAgo = formatSavedAgo(lastSavedAt)

  const toggleTheme = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    applyTheme(next)
  }

  const notify = (text: string, variant: Toast['variant'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, variant }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
  }

  const doSave = () => {
    if (saveDraft()) notify('Draft saved to this browser.', 'success')
    else
      notify(
        'Could not save draft — browser storage is full. Try removing or shrinking uploaded images.',
        'warning',
      )
  }

  const doLoad = () => {
    const ok = loadDraft()
    notify(ok ? 'Draft loaded.' : 'No saved draft in this browser.', ok ? 'success' : 'warning')
  }

  const doReset = () => {
    if (!confirm('Clear all fields and remove the saved draft? This cannot be undone.')) return
    reset()
    clearDraft()
    notify('Form reset.', 'info')
  }

  // ---- Portable draft + customer-response import ----------------------------

  const doExportDraft = () => {
    try {
      const json = serializeDraftFile(data)
      downloadText(json, draftFileName(data.customer.legalName), 'application/json')
      notify('Draft exported as a portable .quill.json file.', 'success')
    } catch {
      notify('Could not export the draft file.', 'warning')
    }
  }

  /** Route an uploaded file: .pdf → field readback + review drawer; else → draft import. */
  const onImportFile = async (file: File) => {
    const isPdf =
      file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    if (isPdf) {
      try {
        const bytes = new Uint8Array(await file.arrayBuffer())
        const res = await readPdfFields(bytes)
        if (!res.ok) {
          notify(res.error, 'warning')
          return
        }
        if (!res.recognized) {
          notify('No recognizable order-form fields were found in this PDF.', 'warning')
          return
        }
        const groups = buildReviewModel(data, res.values)
        setReviewGroups(groups)
        setReviewSource(file.name)
        setReviewOpen(true)
      } catch {
        notify('Could not read this PDF.', 'warning')
      }
      return
    }
    // Draft file (.quill.json / .json)
    try {
      const text = await file.text()
      const parsed = parseDraftFile(text)
      if (!parsed.ok) {
        notify(parsed.error, 'warning')
        return
      }
      importData(parsed.data)
      notify('Draft imported successfully. Save Locally to keep it in this browser.', 'success')
    } catch {
      notify('This does not look like a Quill draft file.', 'warning')
    }
  }

  const applyReview = (item: ReviewItem) => update((prev) => applyReviewItem(prev, item))
  const applyReviewAll = (items: ReviewItem[]) =>
    update((prev) => items.reduce((d, it) => applyReviewItem(d, it), prev))

  // ---- Export flow ----------------------------------------------------------

  /** Entry point for every export button; applies the mode's QA gating. */
  const requestExport = (modeId: ExportModeId) => {
    if (downloading) return
    // Any export attempt counts as asking for validation — turn the readiness
    // dashboard on so results (and any block/confirm) are visible from here on.
    runReadinessCheck()
    const mode = EXPORT_MODES[modeId]
    const decision = getExportDecision(mode, report)

    if (decision.blocked) {
      const n = report.errors.length
      notify(
        `Fix ${n} required field${n === 1 ? '' : 's'} before the ${mode.label}.`,
        'warning',
      )
      const first = report.errors[0]
      if (first) onFocusIssue(first.sectionId, first.fieldId)
      return
    }

    if (decision.needsConfirm) {
      setPendingMode(mode)
      setModalOpen(true)
      return
    }

    void runExport(mode)
  }

  const runExport = async (mode: ExportMode) => {
    setDownloading(mode.id)
    try {
      const bytes = await generate(mode.id, data)
      const mime =
        mode.ext === 'pdf'
          ? 'application/pdf'
          : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      downloadBytes(bytes, buildExportFileName(data.customer.legalName, mode), mime)
      recordExport(mode.id)
      notify(exportSuccessMessage(mode), 'success')
    } catch (err) {
      console.error(err)
      const detail = err instanceof Error ? ` (${err.message})` : ''
      notify(`Could not generate ${mode.label}${detail}.`, 'warning')
    } finally {
      setDownloading(null)
    }
  }

  const confirmExport = () => {
    if (!pendingMode) return
    const mode = pendingMode
    setModalOpen(false)
    void runExport(mode)
  }

  const reviewIssues = () => {
    setModalOpen(false)
    const first = report.errors[0] ?? report.warnings[0]
    if (first) onFocusIssue(first.sectionId, first.fieldId)
  }

  const pendingFilename = pendingMode
    ? buildExportFileName(data.customer.legalName, pendingMode)
    : ''

  return (
    <>
      <div className="h-1 accent-gradient" aria-hidden />
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-card/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1800px] flex-nowrap items-center gap-x-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src="/quill-logo.png"
              alt="Quill logo"
              className="h-11 w-11 shrink-0"
              draggable={false}
            />
            <div className="min-w-0 leading-tight">
              <div className="font-display text-[20px] font-bold -tracking-[0.01em] text-slate-950">
                Quill
              </div>
              <div className="hidden truncate text-[11px] text-slate-500 lg:block">
                Service Order Form Generator
              </div>
            </div>
          </div>

          <div className="ml-2 hidden shrink-0 flex-col items-start gap-0.5 lg:flex">
            <ReadinessChip report={report} checked={checked} saveStatus={saveStatus} />
            {savedAgo && (
              <span className="pl-0.5 text-[10px] text-slate-400">Saved locally · {savedAgo}</span>
            )}
          </div>

          {/* Draft · Export group · Utilities */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            <div className="hidden items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 md:flex">
              <Button
                variant="ghost"
                size="icon"
                onClick={doLoad}
                className="h-8 w-8"
                aria-label="Load Local Draft"
                title="Load Local Draft — restore the draft saved in this browser"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={doSave}
                className="h-8 w-8"
                aria-label="Save Locally"
                title="Save Locally — save this draft in this browser"
              >
                <Save className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={doExportDraft}
                className="h-8 w-8"
                aria-label="Export Draft"
                title="Export Draft — download a portable .quill.json file to keep or share"
              >
                <FileJson className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setImportOpen(true)}
                className="h-8 w-8"
                aria-label="Import Response"
                title="Import Response — upload an exported draft or a customer-returned fillable PDF"
              >
                <FileInput className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={doReset}
                className="h-8 w-8"
                aria-label="Reset"
                title="Reset — clear all fields and remove the saved draft"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>

            {/* Subtle divider separating quiet draft actions from exports. */}
            <div className="hidden h-6 w-px bg-slate-200 md:block" aria-hidden />

            {/* Export cluster: three secondary outputs, then the single primary. */}
            <div className="hidden items-center gap-2 md:flex">
              <ExportButton
                mode={EXPORT_MODES.draft}
                icon={<FileClock className="h-3.5 w-3.5" />}
                downloading={downloading}
                onClick={() => requestExport('draft')}
              />
              <ExportButton
                mode={EXPORT_MODES.docx}
                icon={<FileType className="h-3.5 w-3.5" />}
                downloading={downloading}
                onClick={() => requestExport('docx')}
              />
              <ExportButton
                mode={EXPORT_MODES.fillable}
                icon={<FileDown className="h-3.5 w-3.5" />}
                downloading={downloading}
                onClick={() => requestExport('fillable')}
              />
              {/* Primary action — the single brand-teal button the eye lands on. */}
              <Button
                size="sm"
                onClick={() => requestExport('final')}
                disabled={downloading !== null}
                title={EXPORT_MODES.final.description}
                className="shadow-sm"
              >
                {downloading === 'final' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {downloading === 'final' ? 'Preparing…' : 'Final PDF'}
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={
                theme === 'dark'
                  ? 'Switch to light mode — exported documents always stay light'
                  : 'Switch to dark mode — exported documents always stay light'
              }
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>

            {/* Kebab menu when the buttons don't fit */}
            <div className="relative md:hidden">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMenuOpen((v) => !v)}
                aria-expanded={menuOpen}
              >
                <MoreHorizontal className="h-4 w-4" /> Actions
              </Button>
              <AnimatePresence>
                {menuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-1.5 w-56 rounded-lg border border-slate-200 bg-card p-1 shadow-pop"
                  >
                    <MenuItem icon={<FolderOpen className="h-3.5 w-3.5" />} label="Load Local Draft" onClick={() => { setMenuOpen(false); doLoad() }} />
                    <MenuItem icon={<Save className="h-3.5 w-3.5" />} label="Save Locally" onClick={() => { setMenuOpen(false); doSave() }} />
                    <MenuItem icon={<FileJson className="h-3.5 w-3.5" />} label="Export Draft" onClick={() => { setMenuOpen(false); doExportDraft() }} />
                    <MenuItem icon={<FileInput className="h-3.5 w-3.5" />} label="Import Response" onClick={() => { setMenuOpen(false); setImportOpen(true) }} />
                    <MenuItem icon={<RotateCcw className="h-3.5 w-3.5" />} label="Reset" onClick={() => { setMenuOpen(false); doReset() }} />
                    <div className="my-1 h-px bg-slate-100" />
                    <MenuItem icon={<FileClock className="h-3.5 w-3.5" />} label="Draft PDF" onClick={() => { setMenuOpen(false); requestExport('draft') }} />
                    <MenuItem icon={<FileType className="h-3.5 w-3.5" />} label="Editable DOCX" onClick={() => { setMenuOpen(false); requestExport('docx') }} />
                    <MenuItem icon={<FileDown className="h-3.5 w-3.5" />} label="Fillable PDF" onClick={() => { setMenuOpen(false); requestExport('fillable') }} />
                    <MenuItem icon={<Download className="h-3.5 w-3.5" />} label="Final PDF" primary onClick={() => { setMenuOpen(false); requestExport('final') }} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      <ExportConfirmationModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        mode={pendingMode}
        report={report}
        data={data}
        filename={pendingFilename}
        exporting={downloading !== null}
        onConfirm={confirmExport}
        onReviewIssues={reviewIssues}
      />

      <ImportResponseDialog open={importOpen} onOpenChange={setImportOpen} onFile={onImportFile} />

      <CustomerReviewDrawer
        open={reviewOpen}
        groups={reviewGroups}
        sourceName={reviewSource}
        onOpenChange={setReviewOpen}
        onApply={applyReview}
        onApplyAllSafe={applyReviewAll}
      />

      <div className="pointer-events-none fixed right-4 top-16 z-50 flex w-80 flex-col gap-2">
        <AnimatePresence initial={false}>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: -6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.98 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="pointer-events-auto"
            >
              <div
                className={cn(
                  'rounded-lg border px-3 py-2.5 text-[12px] font-medium shadow-pop',
                  t.variant === 'success' && 'border-teal-200 bg-teal-50 text-teal-800',
                  t.variant === 'warning' && 'border-amber-200 bg-amber-50 text-amber-900',
                  t.variant === 'info' && 'border-slate-200 bg-card text-slate-900',
                )}
              >
                {t.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  )
}

function ExportButton({
  mode,
  icon,
  downloading,
  onClick,
}: {
  mode: ExportMode
  icon: React.ReactNode
  downloading: ExportModeId | null
  onClick: () => void
}) {
  const busy = downloading === mode.id
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={downloading !== null}
      title={mode.description}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : icon}
      {busy ? 'Preparing…' : mode.label}
    </Button>
  )
}

function MenuItem({
  icon,
  label,
  onClick,
  primary,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  primary?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]',
        primary
          ? 'bg-primary text-primary-foreground hover:bg-primary/90'
          : 'text-slate-800 hover:bg-slate-100',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

const CHIP_TONE: Record<ReadinessStatus, string> = {
  'needs-attention': 'border-rose-200 bg-rose-50 text-rose-700',
  'almost-ready': 'border-amber-200 bg-amber-50 text-amber-800',
  ready: 'border-teal-200 bg-teal-50 text-teal-800',
  'customer-ready': 'border-teal-200 bg-teal-50 text-teal-800',
}

function ReadinessChip({
  report,
  checked,
  saveStatus,
}: {
  report: QaReport
  checked: boolean
  saveStatus: 'clean' | 'unsaved' | 'saved'
}) {
  // Calm neutral chip until the user runs a readiness check.
  if (!checked) {
    return (
      <div className="inline-flex min-w-[164px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600">
        <FileClock className="h-3 w-3" />
        Draft &middot; not checked
        {saveStatus === 'unsaved' && <span className="opacity-70">&middot; Unsaved</span>}
      </div>
    )
  }
  const icon =
    report.status === 'needs-attention' ? (
      <AlertCircle className="h-3 w-3" />
    ) : report.status === 'almost-ready' ? (
      <AlertTriangle className="h-3 w-3" />
    ) : report.status === 'customer-ready' ? (
      <Sparkles className="h-3 w-3" />
    ) : (
      <CheckCircle2 className="h-3 w-3" />
    )
  return (
    <div
      title={`Readiness score ${report.score}/100`}
      className={cn(
        'inline-flex min-w-[164px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium',
        CHIP_TONE[report.status],
      )}
    >
      {icon}
      {report.statusLabel}
      <span className="tabular-nums opacity-70">· {report.score}</span>
      {saveStatus === 'unsaved' && <span className="opacity-70">· Unsaved</span>}
    </div>
  )
}

// ---- Generation dispatch + download ------------------------------------------

async function generate(mode: ExportModeId, data: OrderFormData): Promise<Uint8Array> {
  switch (mode) {
    case 'draft': {
      const { generateDraftPdf } = await import('@/pdf/draftPdf')
      return generateDraftPdf(data)
    }
    case 'fillable': {
      const { generateFillablePdf } = await import('@/pdf/fillablePdf')
      return generateFillablePdf(data)
    }
    case 'final': {
      const { generateFinalPdf } = await import('@/pdf/finalPdf')
      return generateFinalPdf(data)
    }
    case 'docx': {
      const { generateDocx } = await import('@/pdf/docx')
      return generateDocx(data)
    }
  }
}

function exportSuccessMessage(mode: ExportMode): string {
  switch (mode.id) {
    case 'draft':
      return 'Draft PDF downloaded (watermarked, internal review).'
    case 'fillable':
      return 'Fillable PDF downloaded — customer fields remain editable.'
    case 'final':
      return 'Final PDF downloaded.'
    case 'docx':
      return 'Editable DOCX downloaded.'
  }
}

function downloadText(text: string, filename: string, mime: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function downloadBytes(bytes: Uint8Array, filename: string, mime: string) {
  const buf = new Uint8Array(bytes.byteLength)
  buf.set(bytes)
  const blob = new Blob([buf], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** "just now" / "3 min ago" / "2:45 PM" for the last-saved indicator. */
function formatSavedAgo(ts: number | null): string | null {
  if (!ts) return null
  const diff = Date.now() - ts
  if (diff < 45_000) return 'just now'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `${mins} min ago`
  return new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
