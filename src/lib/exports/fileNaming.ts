/**
 * Centralized, safe export filenames so every generator names files the same
 * way. Shape: `SurveySparrow-{Customer}-Order-Form-{Kind}.{ext}`.
 *
 * The prefix is intentionally "SurveySparrow", never "Quill": Quill is the
 * internal app name and must not appear on any customer-facing artefact,
 * including the downloaded filename.
 */
import type { ExportMode } from './exportModes'

/**
 * Turn a customer legal name into a filesystem-safe token:
 *  - strip characters that are unsafe/awkward across OSes
 *  - collapse runs of separators into a single hyphen
 *  - no leading/trailing hyphens
 *  - falls back to "Customer" when empty
 */
export function sanitizeCustomerName(name: string | undefined): string {
  const cleaned = (name ?? '')
    .trim()
    .replace(/[^\w\s-]+/g, ' ') // drop punctuation/symbols
    .replace(/[\s_]+/g, '-') // spaces/underscores → hyphen
    .replace(/-+/g, '-') // collapse double hyphens
    .replace(/^-|-$/g, '') // trim stray hyphens
  return cleaned || 'Customer'
}

export function buildExportFileName(customer: string | undefined, mode: ExportMode): string {
  return `SurveySparrow-${sanitizeCustomerName(customer)}-Order-Form-${mode.kind}.${mode.ext}`
}
