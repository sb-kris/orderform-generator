/**
 * Portable draft file — a self-contained `.quill.json` a Sales associate can
 * download, keep, or share internally, and re-import later (here or on another
 * device/browser). This is NOT a customer-facing artefact: it carries the raw
 * order-form data, never generated PDF/DOCX bytes and no secrets.
 *
 * Import is deliberately tolerant: it accepts the wrapped file shape below, a
 * bare `OrderFormData` blob, older schema versions (migrated up), and rejects
 * anything that clearly isn't a Quill draft with a friendly message — never a
 * crash.
 */
import type { OrderFormData } from '@/state/types'
import { migrateOrderFormData } from '@/state/migrate'
import { TEMPLATE_VERSION } from '@/lib/exports/exportModes'
import { sanitizeCustomerName } from '@/lib/exports/fileNaming'

/** Current on-disk schema. Bump when the file wrapper (not the form) changes. */
export const DRAFT_SCHEMA_VERSION = 1

export type QuillDraftFile = {
  schemaVersion: number
  /** Internal marker so imports can recognise our files; never customer-facing. */
  appInternalName: 'Quill'
  exportedAt: string // ISO timestamp
  templateVersion: string
  docId: string
  orderFormData: OrderFormData
  /** Acknowledged QA warnings, so a re-imported draft keeps them acknowledged. */
  reviewedWarnings: Record<string, string>
}

export function buildDraftFile(data: OrderFormData): QuillDraftFile {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    appInternalName: 'Quill',
    exportedAt: new Date().toISOString(),
    templateVersion: TEMPLATE_VERSION,
    docId: data.documentId,
    orderFormData: data,
    reviewedWarnings: data.ignoredWarnings ?? {},
  }
}

export function serializeDraftFile(data: OrderFormData): string {
  return JSON.stringify(buildDraftFile(data), null, 2)
}

/** `SurveySparrow-{Customer}-Order-Form-Draft.quill.json` (Quill-free prefix). */
export function draftFileName(customer: string | undefined): string {
  return `SurveySparrow-${sanitizeCustomerName(customer)}-Order-Form-Draft.quill.json`
}

export type DraftParseResult =
  | {
      ok: true
      data: OrderFormData
      meta: { schemaVersion: number; exportedAt?: string; templateVersion?: string; docId?: string }
    }
  | { ok: false; error: string }

const NOT_A_DRAFT = 'This does not look like a Quill draft file.'

export function parseDraftFile(text: string): DraftParseResult {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file isn’t valid JSON, so it can’t be imported as a draft.' }
  }
  if (!json || typeof json !== 'object') return { ok: false, error: NOT_A_DRAFT }

  const obj = json as Record<string, unknown>
  // Accept either the wrapped draft-file shape or a bare OrderFormData blob.
  const wrapped = 'orderFormData' in obj || 'schemaVersion' in obj
  const raw = (wrapped ? obj.orderFormData : obj) as Record<string, unknown> | undefined
  if (!raw || typeof raw !== 'object') return { ok: false, error: NOT_A_DRAFT }

  const schemaVersion = typeof obj.schemaVersion === 'number' ? obj.schemaVersion : 1
  if (schemaVersion > DRAFT_SCHEMA_VERSION) {
    return {
      ok: false,
      error: `This draft was exported by a newer version of Quill (schema ${schemaVersion}). Update Quill to import it.`,
    }
  }

  // Hallmark keys of an order form — guards against importing arbitrary JSON.
  const looksLikeForm = 'customer' in raw || 'services' in raw || 'subscription' in raw
  if (!looksLikeForm) return { ok: false, error: NOT_A_DRAFT }

  try {
    const data = migrateOrderFormData(raw as Partial<OrderFormData>)
    return {
      ok: true,
      data,
      meta: {
        schemaVersion,
        exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined,
        templateVersion: typeof obj.templateVersion === 'string' ? obj.templateVersion : undefined,
        docId: typeof obj.docId === 'string' ? obj.docId : undefined,
      },
    }
  } catch {
    return { ok: false, error: 'This draft file could not be read.' }
  }
}
