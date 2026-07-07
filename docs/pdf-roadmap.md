# PDF roadmap — deferred items & rationale

Things intentionally not done in the current pdf-lib generator, with the reason
and the path to do them later. Nothing here blocks internal use.

## PDF outline / bookmarks — deferred

**Want:** a document outline (Customer Information, Services, Billing &
Shipping, Subscription, Terms, Execution, Purchase Order) so readers can jump
between sections in Acrobat's bookmarks panel.

**Why deferred:** `pdf-lib@1.17.1` has **no public outline API**. Adding
bookmarks means hand-building the `/Outlines` dictionary tree and per-section
`/Dest` arrays with low-level `PDFDict`/`PDFRef` calls and page coordinates —
fragile, easy to corrupt, and hard to verify without a full PDF viewer in CI.

**Path forward (any of):**
- Upgrade pdf-lib / evaluate a fork that exposes outlines, then add a small
  `addOutline(sections)` helper keyed off the section-heading Y positions we
  already track.
- Or, once the HTML/CSS + Chromium pipeline lands (see
  `html-css-pdf-engine.md`), get bookmarks from the browser's tagged-PDF output
  for free.

## PDF `Producer` metadata = "pdf-lib" — deferred

**Want:** Producer to read `SurveySparrow` like the other metadata.

**Why deferred:** pdf-lib overwrites the Info dict's Producer on `save()` in
this version, and the `updateMetadata: false` save option isn't available here.
Title / Author / Creator / Subject / Keywords are all correctly `SurveySparrow`
and contain no "Quill"; only the low-signal Producer shows the library name.

**Path forward:** upgrade pdf-lib to a version with `save({ updateMetadata:
false })`, or set Producer in the Chromium/overlay pipeline.

## Delivered this sprint (for reference)

- Semantic fillable field names incl. `customer.signDate`.
- Field tooltips (`/TU`) on all fillable fields.
- Typed-signature field font clamped (10–14 pt, name-length aware) — no longer
  oversized.
- Logical tab order (creation order: signature → name → designation → signDate
  → po.required → po.number → po.amount).
- Metadata title `SurveySparrow Service Order Form - {Customer}`; no "Quill".
- Subscription payment terms rendered as a tinted callout.
- Acceptance page with a Commercial Summary card + End of Order Form marker.
