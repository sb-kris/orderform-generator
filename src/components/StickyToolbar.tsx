import { motion, AnimatePresence } from 'motion/react'
import {
  Download,
  FileDown,
  RotateCcw,
  Save,
  Upload,
  FileType,
  CheckCircle2,
  Circle,
  AlertCircle,
  MoreHorizontal,
  Loader2,
  Moon,
  Sun,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from './ui/button'
import { useStore, clearDraft } from '@/state/store'
import { criticalIssues } from '@/state/validation'
import { cn } from '@/lib/cn'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'

type Toast = { id: number; text: string; variant: 'success' | 'warning' | 'info' }
type Downloading = 'final' | 'fillable' | 'docx' | null

export function StickyToolbar({
  onNavigateToSection,
}: {
  onNavigateToSection: (id: string) => void
}) {
  const { data, saveDraft, loadDraft, reset, saveStatus, lastSavedAt } = useStore()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [downloading, setDownloading] = useState<Downloading>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => getStoredTheme())

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
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2600)
  }

  const doSave = () => {
    if (saveDraft()) {
      notify('Draft saved to this browser.', 'success')
    } else {
      notify(
        'Could not save draft — browser storage is full. Try removing or shrinking uploaded images.',
        'warning',
      )
    }
  }

  const doLoad = () => {
    const ok = loadDraft()
    notify(
      ok ? 'Draft loaded.' : 'No saved draft in this browser.',
      ok ? 'success' : 'warning',
    )
  }

  const doReset = () => {
    if (!confirm('Clear all fields and remove the saved draft? This cannot be undone.'))
      return
    reset()
    clearDraft()
    notify('Form reset.', 'info')
  }

  const doDownloadFinal = async () => {
    if (downloading) return
    const crit = criticalIssues(data)
    if (crit.length) {
      notify(
        `Fix ${crit.length} required field${crit.length === 1 ? '' : 's'} before downloading the Final PDF.`,
        'warning',
      )
      onNavigateToSection(crit[0].sectionId)
      return
    }
    setDownloading('final')
    try {
      const { generateFinalPdf } = await import('@/pdf/finalPdf')
      const bytes = await generateFinalPdf(data)
      downloadBytes(bytes, buildFileName(data, 'Final', 'pdf'), 'application/pdf')
      notify('Final PDF downloaded.', 'success')
    } catch (err) {
      console.error(err)
      notify('Could not generate PDF.', 'warning')
    } finally {
      setDownloading(null)
    }
  }

  const doDownloadFillable = async () => {
    if (downloading) return
    setDownloading('fillable')
    try {
      const { generateFillablePdf } = await import('@/pdf/fillablePdf')
      const bytes = await generateFillablePdf(data)
      downloadBytes(bytes, buildFileName(data, 'Fillable', 'pdf'), 'application/pdf')
      notify('Fillable PDF downloaded – customer fields remain editable.', 'success')
    } catch (err) {
      console.error(err)
      notify('Could not generate fillable PDF.', 'warning')
    } finally {
      setDownloading(null)
    }
  }

  const doDownloadDocx = async () => {
    if (downloading) return
    setDownloading('docx')
    try {
      const { generateDocx } = await import('@/pdf/docx')
      const bytes = await generateDocx(data)
      downloadBytes(
        bytes,
        buildFileName(data, 'Editable', 'docx'),
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      )
      notify('Word DOCX downloaded.', 'success')
    } catch (err) {
      console.error(err)
      const msg = err instanceof Error ? err.message : 'unknown error'
      notify(`Could not generate DOCX (${msg}).`, 'warning')
    } finally {
      setDownloading(null)
    }
  }

  const critCount = criticalIssues(data).length
  const readyToGenerate = critCount === 0

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
              <div className="font-display text-[17px] font-bold tracking-tight text-slate-950">
                Quill
              </div>
              <div className="hidden truncate text-[11px] text-slate-500 lg:block">
                Service Order Form Generator
              </div>
            </div>
          </div>

          <div className="ml-2 hidden shrink-0 flex-col items-start gap-0.5 lg:flex">
            <StatusPill status={saveStatus} ready={readyToGenerate} critCount={critCount} />
            {savedAgo && (
              <span className="pl-0.5 text-[10px] text-slate-400">
                Saved locally · {savedAgo}
              </span>
            )}
          </div>

          {/* Action groups: Draft · Export · Utilities. Kept in this order so
              the eye reads left-to-right from low-stakes drafting to the
              primary Final PDF export, with theme as a trailing utility. */}
          <div className="ml-auto flex shrink-0 items-center gap-2.5">
            {/* Draft group — low-emphasis ghost buttons in a subtle tray */}
            <div className="hidden items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 md:flex">
              <Button variant="ghost" size="sm" onClick={doLoad} className="h-8">
                <Upload className="h-3.5 w-3.5" /> Load
              </Button>
              <Button variant="ghost" size="sm" onClick={doSave} className="h-8">
                <Save className="h-3.5 w-3.5" /> Save
              </Button>
              <Button variant="ghost" size="sm" onClick={doReset} className="h-8">
                <RotateCcw className="h-3.5 w-3.5" /> Reset
              </Button>
            </div>

            {/* Export group — secondary outlines + primary Final PDF */}
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="outline"
                size="sm"
                onClick={doDownloadDocx}
                disabled={downloading !== null}
              >
                {downloading === 'docx' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileType className="h-3.5 w-3.5" />
                )}
                {downloading === 'docx' ? 'Preparing…' : 'DOCX'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={doDownloadFillable}
                disabled={downloading !== null}
              >
                {downloading === 'fillable' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <FileDown className="h-3.5 w-3.5" />
                )}
                {downloading === 'fillable' ? 'Preparing…' : 'Fillable PDF'}
              </Button>
              <Button
                size="sm"
                onClick={doDownloadFinal}
                disabled={downloading !== null}
                className="bg-foreground text-background shadow-sm hover:bg-foreground/90"
              >
                {downloading === 'final' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {downloading === 'final' ? 'Preparing…' : 'Final PDF'}
              </Button>
            </div>

            {/* Utilities */}
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
                    <MenuItem
                      icon={<Upload className="h-3.5 w-3.5" />}
                      label="Load Draft"
                      onClick={() => {
                        setMenuOpen(false)
                        doLoad()
                      }}
                    />
                    <MenuItem
                      icon={<Save className="h-3.5 w-3.5" />}
                      label="Save Draft"
                      onClick={() => {
                        setMenuOpen(false)
                        doSave()
                      }}
                    />
                    <MenuItem
                      icon={<RotateCcw className="h-3.5 w-3.5" />}
                      label="Reset"
                      onClick={() => {
                        setMenuOpen(false)
                        doReset()
                      }}
                    />
                    <div className="my-1 h-px bg-slate-100" />
                    <MenuItem
                      icon={<FileType className="h-3.5 w-3.5" />}
                      label="Word DOCX"
                      onClick={() => {
                        setMenuOpen(false)
                        doDownloadDocx()
                      }}
                    />
                    <MenuItem
                      icon={<FileDown className="h-3.5 w-3.5" />}
                      label="Fillable PDF"
                      onClick={() => {
                        setMenuOpen(false)
                        doDownloadFillable()
                      }}
                    />
                    <MenuItem
                      icon={<Download className="h-3.5 w-3.5" />}
                      label="Final PDF"
                      primary
                      onClick={() => {
                        setMenuOpen(false)
                        doDownloadFinal()
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

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
                  t.variant === 'success' &&
                    'border-teal-200 bg-teal-50 text-teal-800',
                  t.variant === 'warning' &&
                    'border-amber-200 bg-amber-50 text-amber-900',
                  t.variant === 'info' &&
                    'border-slate-200 bg-card text-slate-900',
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
          ? 'bg-foreground text-background hover:bg-foreground/90'
          : 'text-slate-800 hover:bg-slate-100',
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function StatusPill({
  status,
  ready,
  critCount,
}: {
  status: 'clean' | 'unsaved' | 'saved'
  ready: boolean
  critCount: number
}) {
  let label = 'Local Draft'
  let icon = <Circle className="h-3 w-3 fill-slate-400 text-slate-400" />
  let color = 'border-slate-200 bg-slate-50 text-slate-700'
  if (status === 'unsaved') {
    label = 'Unsaved Changes'
    icon = <Circle className="h-3 w-3 fill-amber-500 text-amber-500" />
    color = 'border-amber-200 bg-amber-50 text-amber-800'
  } else if (status === 'saved') {
    label = 'Saved'
    icon = <CheckCircle2 className="h-3 w-3 text-teal-600" />
    color = 'border-teal-200 bg-teal-50 text-teal-800'
  }
  if (ready && status !== 'unsaved') {
    label = 'Ready to Generate'
    icon = <CheckCircle2 className="h-3 w-3 text-teal-600" />
    color = 'border-teal-200 bg-teal-50 text-teal-800'
  }
  if (critCount > 0 && status === 'unsaved') {
    label = `${critCount} required · Unsaved`
    icon = <AlertCircle className="h-3 w-3 text-amber-600" />
  }
  return (
    <div
      className={cn(
        // min-width keeps the toolbar from reflowing as the label changes
        // between "Local Draft" / "Unsaved Changes" / "Ready to Generate".
        'inline-flex min-w-[164px] items-center justify-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-medium',
        color,
      )}
    >
      {icon}
      {label}
    </div>
  )
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

function buildFileName(
  data: ReturnType<typeof useStore>['data'],
  kind: 'Final' | 'Fillable' | 'Editable',
  ext: 'pdf' | 'docx',
) {
  // Sanitize the customer name: collapse whitespace/punctuation to single
  // hyphens and trim, so filenames stay clean across OSes.
  const cust =
    (data.customer.legalName || 'Customer')
      .trim()
      .replace(/[^\w]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || 'Customer'
  return `Quill-${cust}-Order-Form-${kind}.${ext}`
}

/** "just now" / "3 min ago" / "2:45 PM" for the last-saved indicator. */
function formatSavedAgo(ts: number | null): string | null {
  if (!ts) return null
  const diff = Date.now() - ts
  if (diff < 45_000) return 'just now'
  const mins = Math.round(diff / 60_000)
  if (mins < 60) return `${mins} min ago`
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}
