import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { PanelRightClose, X } from 'lucide-react'
import { useStore } from '@/state/store'
import { OrderFormDocument } from '@/documentTemplates/orderForm/OrderFormDocument'
import { cn } from '@/lib/cn'
import type { PreviewZoom } from '@/state/types'

/** Natural design width of the preview page, in px. Zoom scales this. */
const BASE_WIDTH = 660
const CANVAS_PAD = 24

const ZOOM_OPTIONS: { value: PreviewZoom; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: '75', label: '75%' },
  { value: '100', label: '100%' },
  { value: '125', label: '125%' },
]

/**
 * Wraps the live document preview with a stable dark canvas + zoom controls.
 *
 * The page renders at a fixed BASE_WIDTH and is scaled with the CSS `zoom`
 * property (crisp, unlike transform:scale which blurs text). "Fit" measures
 * the canvas and scales the page to fill the available width; the fixed
 * levels are absolute. Zoom preference persists via layout prefs.
 */
export function PreviewCanvas({
  variant,
  onHide,
}: {
  variant: 'pane' | 'drawer'
  onHide: () => void
}) {
  const { data, layout, setLayout } = useStore()
  const canvasRef = useRef<HTMLDivElement>(null)
  const [fitZoom, setFitZoom] = useState(1)

  useEffect(() => {
    const el = canvasRef.current
    if (!el) return
    const measure = () => {
      const inner = el.clientWidth - CANVAS_PAD * 2
      if (inner > 0) setFitZoom(Math.max(0.45, Math.min(1.35, inner / BASE_WIDTH)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const mode = layout.previewZoom ?? 'fit'
  const zoom = mode === 'fit' ? fitZoom : Number(mode) / 100

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Live Preview
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center rounded-md border border-slate-200 bg-card p-0.5">
            {ZOOM_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setLayout({ previewZoom: opt.value })}
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums transition-colors',
                  mode === opt.value
                    ? 'bg-foreground text-background'
                    : 'text-slate-500 hover:text-slate-800',
                )}
                title={opt.value === 'fit' ? 'Fit to width' : `Zoom ${opt.label}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onHide}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label={variant === 'drawer' ? 'Close preview' : 'Hide preview'}
            title={variant === 'drawer' ? 'Close preview' : 'Hide preview'}
          >
            {variant === 'drawer' ? (
              <X className="h-4 w-4" />
            ) : (
              <PanelRightClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      {/* Canvas: bg-slate-100 rides the theme channel — a light grey mat in
          light mode, a dark surface in dark mode — so the hardcoded-white
          page always reads as paper floating on a mat. */}
      <div
        ref={canvasRef}
        className="min-h-0 flex-1 overflow-auto rounded-xl bg-slate-100 ring-1 ring-slate-200"
        style={{ padding: CANVAS_PAD }}
      >
        <div className="mx-auto" style={{ width: BASE_WIDTH, zoom } as CSSProperties}>
          <OrderFormDocument data={data} />
        </div>
      </div>
    </div>
  )
}
