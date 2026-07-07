import { useRef, useState } from 'react'
import { ImagePlus, RefreshCw, Trash2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ImageAsset } from '@/state/types'

const ACCEPT = 'image/png,image/jpeg,image/jpg'
const MAX_BYTES = 512 * 1024 // 512 KB – protects localStorage from overflow

/**
 * Polished brand-asset picker – accepts PNG/JPEG, holds the payload as a
 * base64 data URL so it can be embedded directly in the PDF/DOCX and persist
 * in localStorage. Rejects files > 512 KB with a friendly hint.
 *
 * SVG is not accepted here — pdf-lib cannot embed SVG bitmaps without a
 * rasteriser, and unbounded SVGs can be huge in localStorage.
 */
export function ImageUpload({
  value,
  onChange,
  label,
  hint,
  aspect = 'landscape',
}: {
  value: ImageAsset | null
  onChange: (asset: ImageAsset | null) => void
  label: string
  hint?: string
  aspect?: 'landscape' | 'square' | 'signature'
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)

  const pick = () => inputRef.current?.click()
  const clear = () => {
    onChange(null)
    setError(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  const handleFile = (file: File) => {
    setError(null)
    if (!/^image\/(png|jpeg|jpg)$/.test(file.type)) {
      setError('That file type isn’t supported — please use a PNG or JPEG.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That image is a bit large — please use one under 512 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = String(reader.result || '')
      const mime = (file.type as ImageAsset['mime']) || 'image/png'
      // Best-effort width/height detection for aspect-preserving layout.
      const img = new Image()
      img.onload = () => {
        onChange({
          dataUrl,
          mime,
          width: img.naturalWidth,
          height: img.naturalHeight,
          filename: file.name,
        })
      }
      img.onerror = () => {
        onChange({ dataUrl, mime, filename: file.name })
      }
      img.src = dataUrl
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="grid gap-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </div>

      {value ? (
        <div className="group flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-card p-2 shadow-xs">
          {/* Preview tile. Signatures preview on white (like the paper they land
              on) and get a wider frame so the mark is actually legible. The
              max-w-[%] cap lets the tile shrink in a narrow pane instead of
              forcing the whole row (and its grid track) wider than the container. */}
          <div
            className={cn(
              'flex shrink-0 items-center justify-center overflow-hidden rounded-md ring-1 ring-slate-200',
              aspect === 'square' && 'h-12 w-12 bg-slate-50',
              aspect === 'signature' && 'h-14 w-[150px] max-w-[42%] bg-white',
              aspect === 'landscape' && 'h-11 w-[76px] max-w-[42%] bg-slate-50',
            )}
          >
            <img
              src={value.dataUrl}
              alt=""
              className={cn(
                'max-w-full object-contain',
                aspect === 'signature' ? 'max-h-[48px]' : 'max-h-[38px]',
              )}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[12px] font-medium text-slate-700">
              {aspect === 'signature' ? 'Signature added' : 'Image added'}
            </div>
            {value.filename && (
              <div className="truncate text-[11px] text-slate-400" title={value.filename}>
                {value.filename}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={pick}
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            title="Replace image"
            aria-label="Replace image"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={clear}
            className="shrink-0 rounded-md p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-destructive"
            title="Remove image"
            aria-label="Remove image"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={pick}
          className="flex items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-50/40 px-3 py-2.5 text-left text-slate-600 transition-colors hover:border-teal-400 hover:bg-teal-50/40"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400">
            <ImagePlus className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-medium text-slate-800">Upload an image</div>
            <div className="text-[11px] text-slate-500">PNG or JPEG · up to 512 KB</div>
          </div>
        </button>
      )}

      {hint && !error && (
        <div className="break-words text-[11px] text-slate-500">{hint}</div>
      )}
      {error && (
        <div className="break-words text-[11px] font-medium text-destructive">{error}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
