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
| `service-units` | Display-only Qty units | The **Qty / Unit** column reads `50 GB`, `1000 EMAILS`, `100 users`, `10 hrs`, `1 EA` in preview + all exports; totals unchanged (units never affect maths) |
| `net-45` | Net payment term | Callout says **45 days**; the Subscription Fees & Payment clause says **forty-five (45) days** |
| `due-on-receipt` | Due-on-receipt term | Callout says **Payable upon receipt of invoice.**; clause says **payable upon receipt of the invoice** |
| `custom-term` | Custom payment wording | Callout + clause read the custom wording after "payable" (`Payable in three equal monthly installments.`); QA is clean (custom wording set) |
| `review-comments` | Subscription + T&C comments | Score **100**; a neutral **"Customer review comments added."** pass note; both comment blocks render in preview / Final PDF, editable fields in Fillable |
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

## Save / Export / Import (draft + customer-review workflow)

The toolbar's data actions are labelled for where the data goes:

- **Save Locally** — writes the draft to **browser localStorage** (this browser
  only). Toast: "Draft saved to this browser."
- **Load Local Draft** — restores the localStorage draft.
- **Export Draft** — downloads a **portable `.quill.json`** file
  (`SurveySparrow-{Customer}-Order-Form-Draft.quill.json`): `schemaVersion`,
  `exportedAt`, `templateVersion`, `docId`, `orderFormData`, `reviewedWarnings`.
  No secrets, no generated PDF/DOCX bytes. Move it between browsers/devices.
- **Import Response** — opens a chooser for either a `.quill.json` draft file or
  a **customer-returned Fillable PDF**.
- **Reset** — confirms, then clears the form + the saved draft.

**Draft import** validates shape + `schemaVersion` (a newer schema is refused
with a message), migrates missing fields, and never crashes on malformed input
("This does not look like a Quill draft file."). A bare `OrderFormData` blob is
also accepted. Imported drafts land **unsaved** — Save Locally to keep them.

**Filled-PDF readback** (`src/lib/exports/pdfReadback.ts`) reads AcroForm values
via pdf-lib through a field-mapping layer (canonical id → pdf names, with legacy
aliases `po.*`, `customer.date`, `paymentTerms.comments`). Recognised fields:
`customer.legalName`, `soldTo.name/email`, `billing.name/address`,
`shipping.name/address`, `subscription.startDate`, `subscription.paymentMethod`,
`subscription.comments`, `terms.comments`,
`customer.signature/name/designation/signDate`, `po.required/number/amount`. A
PDF with none of these → "No recognizable order-form fields were found in this
PDF." A non-PDF/corrupt file fails gracefully. Dates are parsed loosely
(ISO / "Aug 01, 2026" / dd/mm/yyyy → ISO); PO amount is normalised to a number.

**Customer Review Received drawer** (right-side, never a modal): values grouped
by section (Customer Information, Sold To, Billing & Shipping, Subscription
Details, Subscription Details Review, Terms & Conditions Review,
Execution/Signature, Purchase Order), each showing **Current vs Returned** with a
**New / Changed / Same / Empty** status and per-field **Apply / Ignore**.
Subscription and T&C comments render as prominent comment cards. Bulk: **Apply all safe
changes** (only blank-field → non-empty, i.e. status New), **Ignore all**,
**Close**. A non-empty existing value is **never** overwritten without an
explicit Apply. Applying updates the builder + live preview and recalculates
readiness. **Signature images can't be imported** — the drawer shows a note to
review the PDF manually; only the typed-name signature field reads back.

Readback caveat: filling a PDF outside Quill does not sync back automatically —
to include accepted changes in the **Final PDF**, apply them in the drawer (or
type them into Quill) and **regenerate** the Final PDF.

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
- **Services — Qty / Unit:** the Services table has a **Unit** field beside Qty
  in the app (optional, max 6 chars, casing preserved). The customer-facing
  **Qty / Unit** column shows the quantity with the unit appended (`50 GB`,
  `1000 EMAILS`, `12 mo`, or just `10` when blank) in the preview, all PDFs, the
  DOCX, and the HTML/CSS POC. Units are display-only — subtotal, total, and PO
  amount are unaffected. Drafts saved before this field still load (unit `""`).
- **Page 2 — billing & subscription:** Bill To / Ship To address cards; the
  payment terms render as a tinted **callout** (not a loose italic line). The
  callout **and** the Subscription Fees & Payment clause (clause 3) both derive
  from the single payment-term selection via `formatPaymentTermLegalText` /
  `payableNote` in [`terms.ts`](../src/lib/terms.ts), so they can never disagree.
  Supported terms: **Net 15/30/45/60** (→ "within {spelled} (N) days of receipt
  of the invoice"), **Due on receipt** (→ "upon receipt of the invoice"), and
  **Custom** free-text (completes "payable ___"). No raw
  `{{PAYMENT_TERM_LEGAL_TEXT}}` token ever appears in output.
- **Comments on Subscription Details / Terms & Conditions (review aid):** two
  optional review fields (`subscription.comments` — renamed from the old
  `paymentTerms.comments`, which still imports — and `terms.comments`). The
  Subscription comment covers the whole section (start date, payment method,
  billing period, term, payment terms). In the **Fillable PDF** both are
  **editable multiline** AcroForm text fields (bounded font, tooltips) with a
  subtle "save/download this PDF before sending it back" helper — no native
  sticky-note/annotation. Fillable labels: **CUSTOMER COMMENTS ON SUBSCRIPTION
  DETAILS, IF ANY** and **CUSTOMER COMMENTS ON TERMS & CONDITIONS, IF ANY**. In
  **Final / preview** they render as plain text under **Subscription Details
  Comments** / **Terms & Conditions Comments** **only when the app data has
  comments** (never an empty box, no helper text). The **DOCX** always includes
  both labelled areas (text or a blank ruled line) since it is the redline artefact.
- **Page 3 — legal & signature:** Terms are professionally typeset — comfortable
  line-height (~1.5×), a clear gap **before** each numbered clause heading, a
  small gap under the heading, a visible paragraph-to-paragraph gap, and a
  slightly larger clause-to-clause gap (never one dense block); consistent **left
  alignment**; no orphaned clause heading at a page bottom (the heading always
  keeps at least the start of its first paragraph); "…CONTINUED" header when the
  section spans pages. The **T&C comments** box (and the Payment Terms comments
  box) sit **directly below their section when they fit**, and only move to the
  next page when they genuinely don't — the label + box are never split. Execution
  cards balanced; typed signature restrained; uploaded signature fits.
- **Editable legal text (app-only guardrail):** The "Unlock to edit" affordance
  is an **accidental-change guardrail, not security**. Unlocking requires typing
  the exact word **`CHANGE`** (case-sensitive) in a confirmation step — nothing is
  stored or checked against a secret; it just stops stray edits. Unlocking lets a
  rep edit clause **paragraph text** (titles/numbering stay locked) as a
  **per-document override** stored with the draft; the standard template is never
  changed, and reload re-locks. Editing raises the `terms.modified` warning
  (acknowledgeable). The app shows a "Modified" marker per edited clause — it must
  **never** appear in the customer PDF/DOCX (verify with `modified-terms`).
- **Page 4 — acceptance & PO** (when present): Commercial Summary card (Customer,
  Total prominent, Currency, Billing Period, Term, Start, Valid Through), PO
  card, "End of Order Form" marker, footer aligned, no large empty gap.
- **Fillable fields:** customer-editable business/contact fields —
  `customer.legalName`, `soldTo.name/email`, `billing.name/address` (multiline),
  `shipping.name/address` (multiline) — plus `subscription.startDate` (text),
  `subscription.paymentMethod` (**dropdown**), `subscription.comments` +
  `terms.comments` (**multiline**), signature/name/designation/signDate, and PO
  fields. Every value field renders at the **same size as the surrounding static
  text** (≈9.5 pt; addresses ~8.5 pt; PO fields 10 pt — all set explicitly after
  `addToPage`, never auto-sized/oversized). Only the signature line is
  intentionally larger. Bounds match the visual layout, tooltips on hover, tab
  order logical, PO radio exclusive.

## Review comments & readback (internal)

- Both comment fields are **optional** and never affect readiness: no error, no
  warning, no score change when blank. When either has content, the Readiness
  panel shows a single neutral pass note, **"Customer review comments added."**
- **Fillable PDF comments are for customer review.** A customer-returned PDF can
  be read back via **Import Response** — recognised values (including comments)
  appear in the review drawer for Apply/Ignore. Filling a PDF does **not** sync
  back automatically; you must import it.
- **To include accepted comments in the Final PDF**, apply them in the review
  drawer (or type them into Quill — the Subscription "Customer Comments on
  Subscription Details" and Terms "Customer Comments on Terms & Conditions"
  fields) and **regenerate** the Final PDF.
- Future improvement: import filled PDF fields back into Quill.

## Compatibility matrix (spot-check per release)

See [`pdf-compatibility.md`](./pdf-compatibility.md) for detail.

| Viewer | What to confirm |
| --- | --- |
| **Adobe Acrobat** | Reference target — fillable fields editable + save, PO radio exclusive, signature not oversized, **payment-method dropdown value not oversized** (matches other fields), comment boxes multiline |
| **Chrome PDF viewer** | Renders + fields fillable; values persist on download (styling may differ); dropdown value sized like other fields |
| **Apple Preview** | Renders; field appearance/radio may differ — don't trust for final look |
| **E-sign tools (DocuSign/Adobe Sign/PandaDoc)** | May re-map/ignore AcroForm fields; expect to place signer tags in their editor. Quill's fillable PDF is **not** a legal e-signature. |
