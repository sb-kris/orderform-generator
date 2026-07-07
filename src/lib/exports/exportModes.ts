/**
 * The four export modes and the QA-gating policy that governs each one.
 *
 * Gating philosophy:
 *  - **Final PDF** is the customer-ready artefact → strongest bar: errors block
 *    it, and we always show the confirmation/summary before it downloads.
 *  - **Fillable PDF / DOCX** are collaboration artefacts → errors never block,
 *    but if anything is off we surface the confirmation first.
 *  - **Draft PDF** is a throwaway internal review copy (watermarked) → most
 *    permissive; it downloads immediately unless there's something to flag.
 */
import type { QaReport } from '@/lib/qa/documentQa'

/** Template revision stamped into exports + shown in the app metadata. */
export const TEMPLATE_VERSION = 'v1.0'

export type ExportModeId = 'draft' | 'fillable' | 'final' | 'docx'

export type ExportMode = {
  id: ExportModeId
  /** Button / menu label. */
  label: string
  /** Filename suffix token. */
  kind: 'Draft' | 'Fillable' | 'Final' | 'Editable'
  ext: 'pdf' | 'docx'
  /** One-line description used in tooltips + the confirmation modal. */
  description: string
  /** Errors in the QA report prevent this export. */
  blockOnErrors: boolean
  /** Show the confirmation/summary modal on every export, even when clean. */
  alwaysConfirm: boolean
}

export const EXPORT_MODES: Record<ExportModeId, ExportMode> = {
  draft: {
    id: 'draft',
    label: 'Draft PDF',
    kind: 'Draft',
    ext: 'pdf',
    description:
      'Internal review copy with a DRAFT watermark. Exports freely, even with open issues.',
    blockOnErrors: false,
    alwaysConfirm: false,
  },
  fillable: {
    id: 'fillable',
    label: 'Fillable PDF',
    kind: 'Fillable',
    ext: 'pdf',
    description:
      'Customer signature, name, designation, date and PO fields stay editable. Good for sending to the customer to complete.',
    blockOnErrors: false,
    alwaysConfirm: false,
  },
  final: {
    id: 'final',
    label: 'Final PDF',
    kind: 'Final',
    ext: 'pdf',
    description:
      'Flattened, print-ready order form. Send when every field is complete. Requires all required fields.',
    blockOnErrors: true,
    alwaysConfirm: true,
  },
  docx: {
    id: 'docx',
    label: 'Editable DOCX',
    kind: 'Editable',
    ext: 'docx',
    description:
      'Word document for legal / redline / internal editing — not the primary customer-facing output.',
    blockOnErrors: false,
    alwaysConfirm: false,
  },
}

export type ExportDecision = {
  /** Export cannot proceed — errors must be fixed first. */
  blocked: boolean
  /** Show the confirmation/summary modal before exporting. */
  needsConfirm: boolean
}

export function getExportDecision(mode: ExportMode, report: QaReport): ExportDecision {
  const blocked = mode.blockOnErrors && report.errors.length > 0
  const needsConfirm = !blocked && (mode.alwaysConfirm || report.issueCount > 0)
  return { blocked, needsConfirm }
}
