# Quill — internal release checklist

Short pre-release gate before handing Quill to the internal Sales / RevOps team
for testing. "Quill" is the internal app name only — it must never appear in a
customer-facing artefact.

## Automated (run before every release)

```bash
npm run typecheck     # must be clean
npm run build         # must succeed (the pdf-lib chunk-size warning is expected)
npm run verify:qa     # QA scores per fixture + one of each export → /tmp
```

- [ ] `typecheck` clean
- [ ] `build` succeeds
- [ ] `verify:qa` scores match expectations (clean deals 100/Customer-ready;
      `po-required-missing` 72/Needs-attention; warning fixtures 95/Almost-ready)

## Exports — hardening (verified 2026-07-07)

| Check | Status |
| --- | --- |
| Filenames use `SurveySparrow-{Customer}-Order-Form-{Kind}.{ext}` across all 4 | ✅ |
| No "Quill" in any filename, visible content, or PDF/DOCX metadata | ✅ |
| PDF Title/Author/Creator/Subject/Keywords = SurveySparrow | ✅ |
| Draft + Final PDFs fully flattened (0 editable fields) | ✅ |
| Fillable PDF has exactly the 7 customer fields; none off-page | ✅ |
| Fillable typed signature font is 14 pt (not auto-sized huge); shrinks for long names | ✅ |
| PO radio group mutually exclusive (`Yes`/`No`) | ✅ |
| DOCX: no banner/background image (SS logo only); 8 tables; static footer (no PAGE fields) | ✅ |
| DOCX metadata = SurveySparrow, editable | ✅ |
| Customer-facing docs contain no e-signature disclaimer (app-only) | ✅ |
| Multi-page: PO fits inline (`po-required`, 3 pp) or gets the Acceptance page (`many-lines`, 4 pp) | ✅ |

Known minor: the PDF **Producer** field reads `pdf-lib` (the library sets it on
save; the opt-out isn't available in the pinned version). Low signal — no Quill,
no customer data. Fixable when pdf-lib is upgraded.

## App — manual smoke (do once per release)

- [ ] Readiness score + status update live as fields change
- [ ] Warning **Mark reviewed** → score rises, warning moves to **Reviewed** area
- [ ] **Restore** brings an acknowledged warning back
- [ ] Editing a field re-surfaces its acknowledged warning (auto-reset)
- [ ] Clicking an issue scrolls to + focuses + flashes the field
- [ ] Uploaded customer logo appears in the preview (aspect-preserved)
- [ ] Final PDF blocked while errors exist; confirmation modal shows on export
- [ ] Warning-path modal shows **Review issues / Cancel / Export anyway**
- [ ] Dark **and** light mode both render the readiness panel correctly
- [ ] Save / Load / Reset draft work; "Saved locally" timestamp shows
- [ ] Terms "Unlock to edit" → passphrase dialog; wrong passphrase errors, correct
      one unlocks (friction guardrail, **not** security — passphrase is in the bundle).
      Editing a clause shows a **Modified** marker + raises the `terms.modified`
      warning; "Reset to standard" / "Reset all" clear overrides; reload re-locks
      but keeps the edits. The **Modified marker never appears in the customer
      PDF/DOCX** — only the edited text does.

## Manual export eyeball (recommended, needs a real viewer)

The build environment has no PDF rasterizer, so these are the human checks:

- [ ] Open the **Fillable PDF in Adobe Acrobat** — fields editable, signature
      field not oversized, PO radio exclusive (see `pdf-compatibility.md`)
- [ ] Open the **Final PDF** — page 1 branding intact, services/total aligned,
      Execution + Acceptance/PO pages read cleanly, no orphaned content
- [ ] Open the **Draft PDF** — DRAFT watermark visible on every page
- [ ] Open the **DOCX in Word + Google Docs** — clean header, editable tables,
      signature lines editable, no broken numbering

## Verdict

Automated gates green and export internals verified. **Ready for internal team
testing** once the manual viewer eyeball above is done on a machine with Acrobat
+ Word.
