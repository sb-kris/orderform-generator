# Export QA checklist

Practical checklist for validating Quill's exports before a release or before
sending a document to a customer. Pairs with the automated harness:

```bash
npm run verify:qa     # QA scores for every fixture + one of each export → /tmp
npm run verify:pdf    # Final + Fillable PDF field/structure dump
npm run verify:docx   # DOCX generation smoke test
```

Fixtures live in [`src/lib/qa/fixtures.ts`](../src/lib/qa/fixtures.ts). Each row
below maps to a fixture you can generate and eyeball.

## Readiness engine

| Fixture | What to check | Expected |
| --- | --- | --- |
| `usd-normal` | Baseline complete deal | Score **100**, status **Customer-ready**, 0 issues |
| `eur-deal` / `inr-deal` | Currency formatting | Totals format per locale; INR shows `Rs` in the PDF (₹ is outside the embedded font subset) |
| `long-customer-name` | Header / acceptance summary fit | Name truncates with `…`, never overlaps the logo or Doc ID |
| `long-line-items` | Services table overflow | **Warning** raised; description truncates with `…` in the PDF |
| `logo-mismatch` | Logo-vs-name heuristic | **Warning**: filename doesn't match the customer name |
| `po-required` | PO block populated | No issues; PO number + amount render |
| `po-required-missing` | PO gating | **2 errors** (number + amount); Final PDF blocked |
| `po-not-required` | PO optional | No PO errors |
| `uploaded-signature` | Image signature | Embeds + scales within the signature box |
| `typed-signature` | Typed signature | Renders in the script font, auto-fits long names |
| `many-lines` | 12 line items + PO | 4 pages; PO renders on the **Acceptance & Purchase Order** page with the Commercial Summary card |
| `modified-terms` | Edited legal text | **Warning** `terms.modified`; the overridden clause text renders in the PDF/DOCX with **no "Modified" marker** (marker is app-only) |
| `expired-pricing` | Date validity | **Warning**: pricing valid-through is in the past |
| `empty-draft` | Empty form | Low score, many errors; Draft PDF still exports |

## Export-mode behaviour

- **Draft PDF** — exports even with open errors; DRAFT watermark on every page.
- **Fillable PDF** — exports with warnings; customer signature/name/designation/
  date + PO fields stay editable (AcroForm). PO Required is a single radio group.
- **Final PDF** — **blocked** while any error exists; always shows the
  confirmation summary first; flattened (no editable fields remain).
- **Editable DOCX** — exports with warnings; fully editable in Word/Google Docs.

## Confirmation modal

- Final PDF always opens the modal; other modes open it only when issues exist.
- Summary shows Customer, Total, Currency, Subscription, PO required, Export
  type, and the generated filename.
- **Review issues** jumps to the first issue; **Export anyway** proceeds;
  **Cancel** backs out.

## Smart-fix navigation

- Clicking an issue in the Readiness panel expands its section, scrolls to it,
  focuses the field, and briefly flashes it.

## Acknowledge / ignore warnings

- Every **warning** row has a **Mark reviewed** action; **errors** never do.
- Acknowledging a warning removes it from the score and moves it to the
  **Reviewed warnings (n)** area; **Restore** brings it back.
- Ignored state persists across reload (stored with the draft).
- Changing the field a warning depends on **re-surfaces** it automatically
  (e.g. edit the customer name → the logo-mismatch warning returns).
- The export modal shows active issues **and** the acknowledged count.

## Customer logo

- Uploading a logo shows it immediately in the **preview pane** (top-right,
  aspect-preserved, `object-contain`, never stretched, no filename shown).
- The same logo appears in the exported **PDF**; the mismatch warning appears
  **only in the app**, never inside the document.

## External-facing naming & metadata

- No exported **filename** contains "Quill".
- No **PDF/DOCX metadata** (title/author/creator/keywords) contains "Quill".
- No **visible document content** contains "Quill".
- Customer-facing documents contain **no e-signature disclaimer** (app-only).

`SurveySparrow-{Customer}-Order-Form-{Draft|Fillable|Final|Editable}.{pdf|docx}`
— unsafe characters stripped, spaces → hyphens, no double hyphens.

## Signatures & DOCX

- Fillable PDF typed signature is **not oversized** — name-length-aware font
  (10–14 pt), sits on the baseline.
- Uploaded signature images scale to fit their box.
- DOCX uses **no background/banner image** — clean header (logo + CONFIDENTIAL
  + Doc ID), editable tables, no broken page numbering.

## Per-page PDF visual QA (human eyeball)

The build has no rasterizer, so these are manual on a machine with a PDF viewer.

- **Page 1 — branding:** accent stripe, SurveySparrow logo, CONFIDENTIAL pill +
  Doc ID, background art readable under text, customer logo top-right (aspect
  preserved, not stretched), Customer Info / Sold To / Services table + Total.
- **Page 2 — billing & subscription:** Bill To / Ship To address cards; the
  payment terms render as a tinted **callout** (not a loose italic line). The
  callout ("Payable within N days…") **and** Payment Terms clause 3 ("…within
  {spelled} (N) days…") both derive from the single `subscription.paymentTermDays`
  value (Net 15/30/45/60), so they can never disagree — verify with the `net-45`
  fixture: callout says **45 days** and clause 3 says **forty-five (45) days**.
- **Page 3 — legal & signature:** Terms readable (line-height, clause headers,
  no orphaned heading at page bottom, "…continued" when they span pages);
  Execution cards balanced; typed signature restrained; uploaded signature fits.
- **Editable legal text (app-only guardrail):** The "Unlock to edit" affordance
  is a **friction guardrail, not security** — the passphrase ships in the client
  bundle. Unlocking lets a rep edit clause **paragraph text** (titles/numbering
  stay locked) as a **per-document override** stored with the draft; the standard
  template is never changed, and reload re-locks. Editing raises the `terms.modified`
  warning (acknowledgeable). The app shows a "Modified" marker per edited clause —
  it must **never** appear in the customer PDF/DOCX (verify with `modified-terms`).
- **Page 4 — acceptance & PO** (when present): Commercial Summary card (Customer,
  Total prominent, Currency, Billing Period, Term, Start, Valid Through), PO
  card, "End of Order Form" marker, footer aligned, no large empty gap.
- **Fillable fields:** signature/name/designation/signDate + PO fields editable,
  bounds match the visual layout, tooltips on hover, tab order logical, PO radio
  exclusive.

## Compatibility matrix (spot-check per release)

See [`pdf-compatibility.md`](./pdf-compatibility.md) for detail.

| Viewer | What to confirm |
| --- | --- |
| **Adobe Acrobat** | Reference target — fillable fields editable + save, PO radio exclusive, signature not oversized |
| **Chrome PDF viewer** | Renders + fields fillable; values persist on download (styling may differ) |
| **Apple Preview** | Renders; field appearance/radio may differ — don't trust for final look |
| **E-sign tools (DocuSign/Adobe Sign/PandaDoc)** | May re-map/ignore AcroForm fields; expect to place signer tags in their editor. Quill's fillable PDF is **not** a legal e-signature. |
