# PDF compatibility notes (internal)

Reference for how Quill's PDFs behave across common viewers and e-sign tools.
This is internal documentation — **none of it appears in the customer-facing
PDF**.

## Fillable PDF (AcroForm)

Quill's Fillable PDF uses standard AcroForm fields:

- `customer.signature`, `customer.name`, `customer.designation`, `customer.signDate`
- `subscription.startDate` (text), `subscription.paymentMethod` (**dropdown**)
- `paymentTerms.comments`, `terms.comments` — **multiline** review comment fields
- `po.number`, `po.amount`
- `po.required` — a single radio group (`Yes` / `No`), mutually exclusive by
  construction.

SurveySparrow-side signature fields and all other content are flattened, so
only the customer-facing fields remain editable.

### Field appearance / font size

Variable-text fields (text fields **and** dropdowns) must have their font size
set **explicitly, after `addToPage`** — that call creates the field's `/DA`
entry, which `setFontSize` edits. Without it, pdf-lib auto-sizes the value to
fill the widget height, which renders the selected dropdown value (e.g. a
payment method) or a signature comically large. Quill sets every fillable value
to ≈9.5 pt (comment boxes ~9 pt) so they match the surrounding field text, then
`form.updateFieldAppearances(DMSans)` regenerates the appearance streams at that
size. The multiline comment fields call `enableMultiline()` before `addToPage`.

### Viewer behaviour

- **Adobe Acrobat / Reader** — the reference target. Fields are editable, the
  radio group behaves as expected, tab order follows creation order. **Always
  test the Fillable PDF here before a release.**
- **Browser PDF viewers (Chrome, Edge, Firefox)** — generally render and let
  users fill fields, but styling of field borders/appearances can differ from
  Acrobat. Some older builds don't persist entered values on download.
- **Apple Preview / Quick Look** — fills fields, but appearance streams and
  radio rendering can look different from Acrobat; flattening on save is
  inconsistent. Don't rely on Preview for the definitive look.
- **Mobile viewers** — vary widely; treat as read-only-ish.

## Final PDF

Flattened after generation, so there are no live form fields — it renders
identically everywhere and is the safe artefact to send when complete.

## Draft PDF

Identical layout to Final, flattened, with a diagonal low-opacity **DRAFT**
watermark on every page. For internal review only.

## Fonts & encoding

- Brand fonts (DM Sans, Tenon, Great Vibes) are embedded as subsets.
- The embedded DM Sans subset covers Latin-1 plus `€`/`£`. `₹` is **not** in the
  subset, so INR amounts render with a conventional `Rs` prefix. Smart quotes
  and dashes are normalised to safe equivalents before drawing.
- Fillable field values are sanitised the same way — an out-of-range glyph in a
  field value would otherwise abort the whole export when Acrobat builds the
  appearance stream.

## E-signature tools — important

- Quill's Fillable PDF is **not** a legally binding e-signature. A filled field
  is not a signature with identity, intent, or an audit trail.
- Third-party e-sign platforms (DocuSign, Adobe Sign, PandaDoc) may **re-map or
  ignore** existing AcroForm fields when they overlay their own signature
  anchors. Expect to place signature/date tags in their editor rather than
  relying on Quill's fields.
- True digital signatures (PKI/certificate-based) are **not implemented**.

### Future integration path (Phase 2+)

If a real signing workflow is needed, integrate a provider:

- **DocuSign** — envelopes + signer authentication + completion certificate.
- **Adobe Sign** / **PandaDoc** — comparable capabilities.

The Final PDF (flattened, complete) is the natural artefact to hand to any of
these as the document to be signed.

## Quick manual test matrix

| Viewer | Fillable fields | Radio group | Notes |
| --- | --- | --- | --- |
| Adobe Acrobat | ✅ edit + save | ✅ exclusive | Reference target |
| Chrome/Edge | ⚠️ edit, styling varies | ⚠️ usually OK | Verify values persist |
| Firefox | ⚠️ edit | ⚠️ | |
| Apple Preview | ⚠️ inconsistent | ⚠️ | Don't trust for final look |
