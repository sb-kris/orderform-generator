import { useState } from 'react'
import { Lock, LockOpen, Pencil, RotateCcw } from 'lucide-react'
import { Field, Section } from './Section'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '../ui/accordion'
import { buildTerms } from '@/lib/terms'
import { StatusBadge } from '../ui/status-badge'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Textarea } from '../ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../ui/dialog'
import { useStore } from '@/state/store'

/**
 * The exact word a user must type to unlock the locked legal text for editing.
 *
 * ⚠️ THIS IS AN ACCIDENTAL-CHANGE GUARDRAIL, NOT SECURITY. It is a deliberate
 * friction step so standard legal language can't be edited by a stray click —
 * nothing is stored, nothing is verified against a secret. Editing still works
 * exactly as before once confirmed.
 */
const CONFIRM_WORD = 'CHANGE'

export function TermsSection() {
  const { data, update } = useStore()
  const overrides = data.termOverrides ?? {}

  // Rendered clauses (payment-term interpolated + any overrides applied).
  const terms = buildTerms(data.subscription, overrides)
  // Canonical (standard) clauses — the editor seeds from these when a clause has
  // no override yet, so edits start from the approved text, not stale state.
  const canonical = buildTerms(data.subscription, {})

  // Ephemeral unlock — LOCAL state only, never persisted; reload always re-locks.
  const [unlocked, setUnlocked] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [confirmError, setConfirmError] = useState(false)

  const hasOverrides = Object.keys(overrides).length > 0

  const setOverride = (id: string, paragraphs: string[]) =>
    update((p) => ({
      ...p,
      termOverrides: { ...p.termOverrides, [id]: paragraphs },
    }))

  const resetClause = (id: string) =>
    update((p) => {
      const next = { ...p.termOverrides }
      delete next[id]
      return { ...p, termOverrides: next }
    })

  const resetAll = () => update((p) => ({ ...p, termOverrides: {} }))

  const attemptUnlock = () => {
    // Case-sensitive: only the exact word unlocks.
    if (confirmText === CONFIRM_WORD) {
      setUnlocked(true)
      setConfirmOpen(false)
      setConfirmText('')
      setConfirmError(false)
    } else {
      setConfirmError(true)
    }
  }

  return (
    <Section
      id="terms"
      number="06"
      title="Terms & Conditions"
      description="Standard SurveySparrow order-form terms. Rendered in full inside every generated PDF."
      actions={
        unlocked ? (
          <div className="flex items-center gap-1.5">
            {hasOverrides && (
              <Button variant="ghost" size="sm" onClick={resetAll} title="Discard all manual edits">
                <RotateCcw className="h-3.5 w-3.5" /> Reset all
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setUnlocked(false)}>
              <Lock className="h-3.5 w-3.5" /> Lock terms
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setConfirmText('')
              setConfirmError(false)
              setConfirmOpen(true)
            }}
            title="Unlock to edit the legal text"
          >
            <StatusBadge variant={hasOverrides ? 'warning' : 'muted'}>
              {hasOverrides ? (
                <>
                  <Pencil className="mr-1 h-3 w-3" /> Edited · Unlock to edit
                </>
              ) : (
                <>
                  <Lock className="mr-1 h-3 w-3" /> Unlock to edit
                </>
              )}
            </StatusBadge>
          </button>
        )
      }
      complete
    >
      {unlocked && (
        <p className="rounded-lg border border-dashed border-amber-200 bg-amber-50/50 px-3 py-2 text-[11.5px] text-amber-900">
          Editing legal text for <strong>this document only</strong>. Clause titles and
          numbering stay locked; the standard template is never changed. Edits are a
          per-document override — have any changes legally approved before sending.
        </p>
      )}

      <div className="mt-3 rounded-lg border border-slate-200">
        <Accordion type="multiple">
          {terms.map((t, i) => {
            const modified = !!overrides[t.id]
            // Editor paragraphs: the override (if any) else the standard clause.
            const editorParas = overrides[t.id] ?? canonical[i].paragraphs
            return (
              <AccordionItem key={t.id} value={t.id} className="px-4">
                <AccordionTrigger className="text-sm font-semibold text-slate-900">
                  <span className="flex items-center gap-2">
                    {t.title}
                    {/* App-only marker — NEVER rendered into the customer PDF/DOCX. */}
                    {modified && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-800">
                        <Pencil className="h-2.5 w-2.5" /> Modified
                      </span>
                    )}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-slate-700">
                  {unlocked ? (
                    <div className="space-y-2">
                      {editorParas.map((para, j) => (
                        <Textarea
                          key={j}
                          value={para}
                          onChange={(e) => {
                            const next = editorParas.slice()
                            next[j] = e.target.value
                            setOverride(t.id, next)
                          }}
                          className="min-h-[72px] text-[13px] leading-relaxed"
                        />
                      ))}
                      {modified && (
                        <button
                          type="button"
                          onClick={() => resetClause(t.id)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-teal-700 hover:underline"
                        >
                          <RotateCcw className="h-3 w-3" /> Reset to standard
                        </button>
                      )}
                    </div>
                  ) : (
                    t.paragraphs.map((p, j) => (
                      <p key={j} className="text-[13px] leading-relaxed">
                        {p}
                      </p>
                    ))
                  )}
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
      </div>

      <Field
        label="Customer Comments on Terms & Conditions"
        htmlFor="terms.comments"
        hint="Use this only when the customer or internal reviewer requests changes to the Terms & Conditions. It appears in the document only when filled, and stays editable in the Fillable PDF."
      >
        <Textarea
          id="terms.comments"
          value={data.termsComments}
          onChange={(e) => update((p) => ({ ...p, termsComments: e.target.value }))}
          placeholder="Optional — note any clauses the customer wants to review or change."
          maxLength={800}
          className="min-h-[64px]"
        />
      </Field>
      <p className="text-[11px] text-slate-500">
        Use comments for customer review feedback. Accepted changes should be reviewed
        internally before generating the Final PDF.
      </p>

      {/* Confirmation step — an accidental-change guardrail, not security. */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(o) => {
          setConfirmOpen(o)
          if (!o) {
            setConfirmText('')
            setConfirmError(false)
          }
        }}
      >
        <DialogContent>
          <div className="p-6">
            <DialogTitle className="pr-6">Unlock Terms &amp; Conditions editing?</DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Type <strong>CHANGE</strong> to unlock Terms &amp; Conditions editing. Edits apply to{' '}
              <strong>this document only</strong> and never change the standard template.
            </DialogDescription>
            <div className="mt-4">
              <Input
                value={confirmText}
                autoFocus
                placeholder="CHANGE"
                invalid={confirmError}
                onChange={(e) => {
                  setConfirmText(e.target.value)
                  setConfirmError(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') attemptUnlock()
                }}
              />
              <p className="mt-1.5 text-[11.5px] text-slate-500">
                This prevents accidental edits to standard legal language.
              </p>
              {confirmError && (
                <p className="mt-1.5 text-[11.5px] font-medium text-destructive">
                  Type CHANGE exactly to unlock.
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={attemptUnlock}>
                <LockOpen className="h-3.5 w-3.5" /> Unlock
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Section>
  )
}
