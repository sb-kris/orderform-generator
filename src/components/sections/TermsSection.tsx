import { useState } from 'react'
import { Lock, LockOpen, Pencil, RotateCcw } from 'lucide-react'
import { Section } from './Section'
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
 * Unlock passphrase for editing the locked legal text.
 *
 * ⚠️ THIS IS A FRICTION GUARDRAIL, NOT SECURITY. Quill is a browser-only app,
 * so this string ships in the client bundle and is trivially discoverable. Its
 * only purpose is to stop *casual* edits to reviewed legal text — someone has
 * to mean it. Do not treat it as an access control. Edit freely if the team
 * wants a different word.
 */
const UNLOCK_PASSPHRASE = 'ss-legal'

export function TermsSection() {
  const { data, update } = useStore()
  const netDays = data.subscription.paymentTermDays ?? 30
  const overrides = data.termOverrides ?? {}

  // Rendered clauses (net-term interpolated + any overrides applied).
  const terms = buildTerms(netDays, overrides)
  // Canonical (standard) clauses — the editor seeds from these when a clause has
  // no override yet, so edits start from the approved text, not stale state.
  const canonical = buildTerms(netDays, {})

  // Ephemeral unlock — LOCAL state only, never persisted; reload always re-locks.
  const [unlocked, setUnlocked] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState('')
  const [pwError, setPwError] = useState(false)

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
    if (pw === UNLOCK_PASSPHRASE) {
      setUnlocked(true)
      setPwOpen(false)
      setPw('')
      setPwError(false)
    } else {
      setPwError(true)
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
              <Lock className="h-3.5 w-3.5" /> Re-lock
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setPw('')
              setPwError(false)
              setPwOpen(true)
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

      {/* Unlock passphrase dialog — friction guardrail, not security. */}
      <Dialog
        open={pwOpen}
        onOpenChange={(o) => {
          setPwOpen(o)
          if (!o) {
            setPw('')
            setPwError(false)
          }
        }}
      >
        <DialogContent>
          <div className="p-6">
            <DialogTitle className="pr-6">Unlock legal text for editing?</DialogTitle>
            <DialogDescription className="mt-2 text-[13px] leading-relaxed text-slate-600">
              Editing applies to <strong>this document only</strong> and never changes the
              standard template. Enter the passphrase to continue.
            </DialogDescription>
            <div className="mt-4">
              <Input
                type="password"
                value={pw}
                autoFocus
                placeholder="Passphrase"
                invalid={pwError}
                onChange={(e) => {
                  setPw(e.target.value)
                  setPwError(false)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') attemptUnlock()
                }}
              />
              {pwError && (
                <p className="mt-1.5 text-[11.5px] font-medium text-destructive">
                  That passphrase isn’t correct. The legal text stays locked.
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setPwOpen(false)}>
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
