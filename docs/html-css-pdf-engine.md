# HTML/CSS document engine — architecture note

Direction for maturing Quill's document generation toward SaaS-quality
templates, and why it isn't fully switched on yet.

## Where we are today

- Quill is a **100% client-side** Vite/React app. No backend, no Node at
  runtime.
- Exports are produced **in the browser**: `pdf-lib` for the PDFs (Draft /
  Final / Fillable), `docx` for the Word file.
- There is now a **reusable HTML/CSS document template**:
  `src/documentTemplates/orderForm/OrderFormDocument.tsx` +
  `orderFormPrint.css`. It is decoupled from the app UI (takes `OrderFormData`
  as a prop, reads no store) and is what the **live preview** renders — so
  preview and the intended print layout share one source of truth.

## Why HTML/CSS rendering helps

pdf-lib draws by absolute coordinates. Every card, page break, and column is
hand-placed maths — powerful for form fields, painful for typography, flowing
legal text, and "keep this heading with its paragraph". HTML/CSS gives us:

- real text flow, line-height, justification, hyphenation
- `break-inside: avoid`, `break-after: avoid`, orphan/widow control
- grid/flex cards without pixel maths
- one template that renders identically in preview and export

## Target architecture (hybrid)

```
OrderFormData
     │
     ▼
OrderFormDocument (HTML/CSS)  ──►  Chromium/Playwright  ──►  static, polished PDF
                                                                   │
                                                                   ▼
                                              pdf-lib overlays AcroForm fields
                                              (customer.signature, customer.name,
                                               customer.designation, customer.signDate,
                                               po.required, po.number, po.amount)
                                                                   │
                                                                   ▼
                                                        Fillable PDF (final)
```

1. **Chromium renders the template to a static PDF** (`page.pdf()`), honouring
   the print CSS (`@page` size/margins, page breaks). This becomes the
   visual/Final PDF.
2. **pdf-lib opens that PDF and overlays the AcroForm fields** at known
   coordinates for the Fillable variant. pdf-lib stays the fillable-field layer.

## Working POC — `npm run export:pdf:html-poc`

There is now a **working local proof of concept** that renders the exact
`OrderFormDocument` template to a real PDF, entirely offline:

```bash
npm run build                 # compiles the CSS the POC reuses
npm run export:pdf:html-poc   # → poc-exports/order-form.experimental.<fixture>.pdf
npm run export:pdf:html-poc eur-deal   # any fixture name (default: many-lines)
```

Pipeline (`scripts/export-html-poc.mts`): esbuild SSRs the template →
`renderToStaticMarkup` → inline the compiled CSS + fonts + page-1 background as
`data:` URIs → **headless Google Chrome `--print-to-pdf`** on a `file://` page.

**No Playwright, no Chromium download, no network** — it uses the system Chrome
that's already installed.

### What worked

- The PDF is **visually identical to the live preview** (same template, same
  CSS) — true preview-to-export consistency.
- Real typographic quality: proper kerning, `@page` size/margins, `break-inside`
  keeping cards/sections whole.
- Fully branded (accent bar, logo, CONFIDENTIAL, Doc ID, hero background); **no
  "Quill"** anywhere in bytes or metadata; clean `<title>`.

### What failed / had to be worked around

- `--headless=new` on this **MDM-managed Chrome** hung forever (background
  extensions never settle). Fixed with classic `--headless` +
  `--disable-extensions --disable-background-networking` etc.
- **`localhost` HTTP stalled** under the enterprise proxy, so a local static
  server hung. Fixed by inlining every asset as `data:` URIs and printing from
  `file://`.

### What remains before it can replace the pdf-lib engine

- **Fillable fields** (biggest item — see below): the POC is static only.
- **Per-page running footer** (`SurveySparrow · Confidential · Doc ID · Page N`).
  Chrome's own header/footer is disabled; add via CSS `@page` margin boxes or a
  fixed footer element.
- **Page-break tuning**: `break-inside: avoid` on Services can leave page-1
  bottom whitespace when the table is long — needs balancing.
- **A render host**: Node + Chrome must run *somewhere* (local dev script today;
  a small export service for the browser app later — see below).

## Why it isn't the shipping engine yet

Playwright/Chromium (or system Chrome) needs **Node and a real browser** — the
app deploys as a static, browser-only bundle. Wiring this into the app's export
buttons means a backend/export service, which is out of scope (see NON-GOALS).
So for now:

- The **HTML/CSS template ships and powers the preview today** (immediate win).
- The **POC proves the PDF quality** via a local script.
- The **current pdf-lib exports remain the shipping exports** and are untouched.

## How to introduce Playwright later (local/dev or export service)

Two viable shapes, in increasing order of infrastructure:

1. **Local dev script** — a Node script that boots Vite (or serves a built
   bundle), navigates Playwright to a headless `/document-preview/order-form`
   route with the data injected, and calls `page.pdf()`. Gated behind
   `npm run export:pdf:html-poc`. Good for generating golden/reference PDFs.
2. **Export microservice** — the same renderer behind a small HTTP service the
   app calls when a server is available (the natural SaaS path). The client
   keeps the pure-browser pdf-lib export as an **offline fallback**.

Field overlay is coordinate-based: the template emits stable anchor elements
(e.g. `data-field="customer.signature"` with known page + rect), the Node step
reads those rects and places pdf-lib fields there. This keeps the visual layer
(CSS) and the interactive layer (pdf-lib) cleanly separated.

## Fallback strategy / guarantees

- The browser-only `pdf-lib` + `docx` exports **always work**, with or without
  a render service. They are the baseline, not a stopgap.
- The HTML/CSS template is **additive**: it improves preview now and unlocks the
  Playwright path later without a rewrite.
- No customer-facing output ever contains "Quill" (internal app name only).

## Status

| Piece | Status |
| --- | --- |
| Reusable HTML/CSS template | ✅ shipped (`documentTemplates/orderForm/`) |
| Print CSS foundation | ✅ shipped (`orderFormPrint.css`) |
| Preview consumes the template | ✅ shipped |
| Local HTML→PDF POC (`export:pdf:html-poc`) | ✅ **working** (system Chrome, offline) |
| Per-page running footer in the HTML PDF | ⏸ todo (CSS `@page` margin boxes) |
| pdf-lib field overlay on an HTML-rendered PDF | ⏸ deferred (design below) |
| Export host/service for the browser app | ⏸ deferred (SaaS path) |
