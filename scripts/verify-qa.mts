// Headless QA + export regression harness.
//
//   TSX_TSCONFIG_PATH=tsconfig.app.json npx tsx scripts/verify-qa.mts
//
// Runs the Document QA engine over every fixture and prints a score/status
// table, then generates one of each export (Draft/Final/Fillable/DOCX) for a
// representative fixture into /tmp for manual inspection. Assets that the
// generators fetch from `/fonts`, `/surveysparrow-logo.png`, etc. are shimmed
// off disk from `public/`.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

const publicDir = resolve(process.cwd(), 'public')
const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url =
    typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
  if (url.startsWith('/')) {
    const p = join(publicDir, url.replace(/^\//, ''))
    if (!existsSync(p)) return new Response('missing', { status: 404 })
    return new Response(new Uint8Array(readFileSync(p)), { status: 200 })
  }
  return originalFetch(input as any, init)
}) as typeof fetch

const { FIXTURES } = await import('../src/lib/qa/fixtures')
const { runDocumentQa } = await import('../src/lib/qa/documentQa')
const { generateDraftPdf } = await import('../src/pdf/draftPdf')
const { generateFinalPdf } = await import('../src/pdf/finalPdf')
const { generateFillablePdf } = await import('../src/pdf/fillablePdf')
const { generateDocx } = await import('../src/pdf/docx')

console.log('\n=== Document QA — fixture report ===\n')
const pad = (s: string, n: number) => s.padEnd(n)
console.log(pad('FIXTURE', 22), pad('SCORE', 7), pad('STATUS', 18), 'ERR', 'WARN')
console.log('-'.repeat(64))
for (const f of FIXTURES) {
  const r = runDocumentQa(f.data)
  console.log(
    pad(f.name, 22),
    pad(`${r.score}/100`, 7),
    pad(r.statusLabel, 18),
    String(r.errors.length).padEnd(3),
    String(r.warnings.length),
  )
}

// Detail dump for the two most interesting fixtures.
for (const name of ['logo-mismatch', 'po-required-missing', 'expired-pricing']) {
  const f = FIXTURES.find((x) => x.name === name)!
  const r = runDocumentQa(f.data)
  console.log(`\n--- ${name}: ${f.description} ---`)
  for (const c of [...r.errors, ...r.warnings]) {
    console.log(`  [${c.status.toUpperCase()}] ${c.section}: ${c.message}`)
  }
}

// Generate one of each export from the PO-required fixture (exercises the
// acceptance page + fillable fields + all currencies feed).
const sample = FIXTURES.find((x) => x.name === 'po-required')!.data
const draft = await generateDraftPdf(sample)
const final = await generateFinalPdf(sample)
const fillable = await generateFillablePdf(sample)
const docx = await generateDocx(sample)
writeFileSync('/tmp/quill-qa-draft.pdf', draft)
writeFileSync('/tmp/quill-qa-final.pdf', final)
writeFileSync('/tmp/quill-qa-fillable.pdf', fillable)
writeFileSync('/tmp/quill-qa.docx', docx)

const { PDFDocument } = await import('pdf-lib')
const pageCount = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount()
console.log('\n=== Sample exports (po-required) ===')
console.log('draft   :', draft.length, 'bytes,', await pageCount(draft), 'pages → /tmp/quill-qa-draft.pdf')
console.log('final   :', final.length, 'bytes,', await pageCount(final), 'pages → /tmp/quill-qa-final.pdf')
console.log('fillable:', fillable.length, 'bytes,', await pageCount(fillable), 'pages → /tmp/quill-qa-fillable.pdf')
console.log('docx    :', docx.length, 'bytes → /tmp/quill-qa.docx')
console.log('\nOK\n')
