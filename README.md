# Quill

**Internal SurveySparrow Service Order Form Generator.**

Quill lets Sales / RevOps assemble a customer-ready Service Order Form and
export it as a print-ready **Final PDF**, a **customer-fillable PDF**, or an
**editable Word DOCX** — entirely in the browser, with no backend.

---

## What it does

- A two-pane workspace: a sectioned form on the left, a live document preview
  on the right (resizable, zoomable, collapsible).
- Eight ordered sections — Customer Information, Sold To, Services, Billing &
  Shipping, Subscription Details, Terms & Conditions, Execution / Signature,
  and Purchase Order — with inline validation and completion status.
- Multi-currency line items (USD, EUR, GBP, INR, CAD, AUD) with automatic
  subtotals and totals.
- Optional customer logo and typed **or** uploaded signatures.
- Local draft save / load, light & dark themes, and a live preview that
  mirrors the exported document.

## Exports

| Output | Description |
| --- | --- |
| **Final PDF** | Flattened, print-ready order form. All values baked in. |
| **Fillable PDF** | Customer signature/name/designation/date and PO fields stay editable as AcroForm fields (radio group for "PO required"). |
| **Editable DOCX** | A clean Word document with the same sections, tables, and branding — editable in Microsoft Word and Google Docs. |

## Tech stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** (CSS-variable-driven light/dark theming)
- **Radix UI** primitives + a small local component library
- **Motion** for subtle transitions
- **pdf-lib** (+ `@pdf-lib/fontkit`) for PDF generation and AcroForm fields
- **docx** for the Word export
- Brand fonts (DM Sans, Tenon, Great Vibes) embedded into the documents

## Setup

Requires Node 18+ (developed on Node 24).

```bash
npm install
```

## Run (development)

```bash
npm run dev
# open http://localhost:5173
```

## Build (production)

```bash
npm run build      # type-checks, then bundles to dist/
npm run preview    # serve the production build locally
```

## Type-check only

```bash
npm run typecheck
```

## Verify document generation (optional)

Headless regression scripts render the exports with `tsx` so you can confirm
PDF fields and DOCX structure without opening the app:

```bash
TSX_TSCONFIG_PATH=tsconfig.app.json npx tsx scripts/verify-pdf.mts
TSX_TSCONFIG_PATH=tsconfig.app.json npx tsx scripts/verify-docx.mts
```

---

## Notes

- **Everything stays local.** All form data lives in the browser via
  `localStorage`. There are no API calls, analytics, or tracking, and no
  environment variables are required.
- **Documents are generated client-side.** PDFs and the DOCX are built in the
  browser and downloaded directly to the user's machine.
- **Exports are always light.** Dark mode applies to the app UI only; the
  generated documents and the preview "paper" are always light and
  customer-ready.
- **The fillable PDF is not a DocuSign replacement.** A fillable field is not
  a legally binding electronic signature. For a true e-signature workflow —
  audit trail, signer authentication, envelope routing, and a completion
  certificate — integrate a provider such as DocuSign, Adobe Sign, or
  PandaDoc.

---

## Folder structure

```
.
├── index.html                 # Vite entry
├── public/                    # Static assets served as-is
│   ├── fonts/                 # Embedded document fonts (DM Sans, Tenon, Great Vibes)
│   ├── page1-background.jpg    # PDF page-1 background art
│   ├── docx-banner.jpg         # DOCX header banner
│   ├── surveysparrow-logo.png  # Brand logo used in PDF/DOCX
│   ├── quill-logo.png          # App header logo
│   ├── quill-*.png, favicon.*  # App icons / favicons
│   └── manifest.webmanifest
├── scripts/                   # Headless export-verification scripts
├── src/
│   ├── main.tsx               # App bootstrap (+ theme init)
│   ├── App.tsx
│   ├── styles.css             # Tailwind layers + theme tokens + @font-face
│   ├── components/
│   │   ├── AppShell.tsx        # Resizable workspace layout
│   │   ├── StickyToolbar.tsx   # Draft / export / theme actions
│   │   ├── PreviewCanvas.tsx   # Zoomable preview surface
│   │   ├── PreviewDocument.tsx # Live document preview
│   │   ├── sections/           # One component per form section
│   │   └── ui/                 # Buttons, inputs, selects, etc.
│   ├── lib/                    # docModel, currency, formatting, theme, helpers
│   ├── pdf/                    # Document generators
│   │   ├── orderForm.ts        # Shared PDF layout (final + fillable)
│   │   ├── finalPdf.ts         # Flattened export
│   │   ├── fillablePdf.ts      # AcroForm export
│   │   ├── docx.ts             # Word export
│   │   ├── layout.ts           # PDF primitives (text, tables, rules)
│   │   └── assets.ts           # Font / image embedding
│   └── state/                 # Store, types, validation
├── tailwind.config.ts
├── vite.config.ts
├── tsconfig*.json
└── package.json
```

> **Naming note:** the package is still named
> `surveysparrow-service-order-form-generator` internally; the product name
> is **Quill**.
