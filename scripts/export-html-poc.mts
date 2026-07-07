/**
 * EXPERIMENTAL — HTML/CSS → PDF proof of concept.
 *
 * Renders the SAME `OrderFormDocument` React/CSS template that powers the live
 * preview to a static PDF, using headless Google Chrome's `--print-to-pdf`.
 * This is the future document engine; it is NOT wired into the app and does
 * NOT replace the pdf-lib exports (Draft/Fillable/Final) or the DOCX export.
 *
 * Pipeline (all local, no network, no Playwright download):
 *   1. esbuild bundles OrderFormDocument for Node (CSS imports dropped — the
 *      compiled CSS comes from the Vite build instead).
 *   2. renderToStaticMarkup() → static HTML for a chosen fixture.
 *   3. Compose a self-contained page: <style>{built CSS}</style> + the markup.
 *   4. A tiny local server serves that HTML plus /public assets (fonts, page-1
 *      background) so Chrome can resolve them.
 *   5. Chrome headless prints it to PDF honouring the template's @page / print
 *      CSS (page size, margins, break-inside).
 *
 * Fillable fields are intentionally out of scope here — see
 * docs/html-css-pdf-engine.md for how pdf-lib will overlay them later.
 *
 * Usage:  npm run export:pdf:html-poc [fixtureName]
 */
import * as esbuild from 'esbuild'
import { readFileSync, readdirSync, mkdirSync, existsSync, statSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'

const ROOT = resolve(process.cwd())
const PUBLIC = join(ROOT, 'public')
const DIST_ASSETS = join(ROOT, 'dist', 'assets')
const OUT_DIR = join(ROOT, 'poc-exports')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const fixtureName = process.argv[2] || 'many-lines'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ico': 'image/x-icon',
}

function log(msg: string) {
  process.stdout.write(`${msg}\n`)
}

/** Read a public asset and return a base64 data: URI, or null if missing. */
function toDataUri(absPath: string): string | null {
  if (!existsSync(absPath) || !statSync(absPath).isFile()) return null
  const mime = MIME[extname(absPath)] || 'application/octet-stream'
  return `data:${mime};base64,${readFileSync(absPath).toString('base64')}`
}

async function main() {
  if (!existsSync(CHROME)) {
    console.error(`✗ Google Chrome not found at:\n  ${CHROME}\n` +
      `This POC uses system Chrome's --print-to-pdf. Install Chrome or point CHROME at a Chromium binary.`)
    process.exit(1)
  }
  if (!existsSync(DIST_ASSETS)) {
    console.error('✗ No dist/ build found. Run `npm run build` first (the POC reuses the compiled CSS).')
    process.exit(1)
  }

  // 1) Bundle the template for Node SSR (drop CSS imports; alias @ → src).
  log(`• Bundling OrderFormDocument (fixture: ${fixtureName})…`)
  const entry = `
    import { createElement } from 'react'
    import { renderToStaticMarkup } from 'react-dom/server'
    import { OrderFormDocument } from '@/documentTemplates/orderForm/OrderFormDocument'
    import { FIXTURES } from '@/lib/qa/fixtures'
    export function render(name) {
      const fx = FIXTURES.find((f) => f.name === name) || FIXTURES[0]
      return {
        fixture: fx.name,
        html: renderToStaticMarkup(createElement(OrderFormDocument, { data: fx.data, animate: false })),
      }
    }
  `
  // Write the bundle inside the project so Node resolves the external
  // react/react-dom/motion imports against ./node_modules.
  const bundlePath = join(ROOT, `.poc-bundle-${process.pid}.mjs`)
  await esbuild.build({
    stdin: { contents: entry, resolveDir: ROOT, loader: 'tsx', sourcefile: 'poc-entry.tsx' },
    bundle: true,
    platform: 'node',
    format: 'esm',
    jsx: 'automatic',
    // Bundle only our own template/src; let Node load react, react-dom/server,
    // and motion natively (bundling their CJS into ESM breaks `require('stream')`).
    packages: 'external',
    loader: { '.css': 'empty' },
    alias: { '@': join(ROOT, 'src') },
    outfile: bundlePath,
    logLevel: 'silent',
  })

  // 2) SSR the document.
  const mod = await import(pathToFileURL(bundlePath).href)
  const rendered = mod.render(fixtureName)
  let bodyHtml: string = rendered.html
  const fixture: string = rendered.fixture
  rmSync(bundlePath, { force: true }) // clean up the temp SSR bundle

  // 3) Compose a FULLY self-contained page: inline the compiled CSS, the
  //    @font-face fonts, and the page-1 background as data: URIs. This lets us
  //    render from file:// — headless Chrome on this managed machine stalls on
  //    localhost HTTP (enterprise proxy), but file:// prints instantly.
  const cssFiles = readdirSync(DIST_ASSETS).filter((f) => f.endsWith('.css'))
  let builtCss = cssFiles.map((f) => readFileSync(join(DIST_ASSETS, f), 'utf8')).join('\n')
  let fontsInlined = 0
  builtCss = builtCss.replace(/url\(\s*['"]?(\/fonts\/[^'")?#]+)[^)]*\)/g, (m, p) => {
    const uri = toDataUri(join(PUBLIC, p))
    if (uri) { fontsInlined++; return `url(${uri})` }
    return m
  })
  const bgUri = toDataUri(join(PUBLIC, 'page1-background.jpg'))
  if (bgUri) bodyHtml = bodyHtml.split('/page1-background.jpg').join(bgUri)
  log(`• Inlined ${fontsInlined} font refs${bgUri ? ' + page-1 background' : ''}.`)

  const page = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>SurveySparrow Service Order Form</title>
<style>${builtCss}</style>
<style>
  /* POC print scaffolding — force backgrounds/colours to print and let the
     document flow full-width within the @page margins from orderFormPrint.css. */
  html, body { margin: 0; padding: 0; background: #fff; }
  * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .odoc { max-width: none; margin: 0; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`

  // 4) Write the self-contained page and print it via file:// with headless Chrome.
  mkdirSync(OUT_DIR, { recursive: true })
  const htmlPath = join(OUT_DIR, `.order-form.experimental.${fixture}.html`)
  writeFileSync(htmlPath, page)
  const outPdf = join(OUT_DIR, `order-form.experimental.${fixture}.pdf`)
  const userDataDir = join(tmpdir(), `poc-chrome-${process.pid}`)
  log(`• Printing with headless Chrome…`)
  const result = spawnSync(
    CHROME,
    [
      // Classic --headless (not =new): on managed/MDM Chrome, --headless=new plus
      // the profile's background extensions cause print-to-pdf to hang forever.
      // The disable-* flags keep a clean, self-terminating headless instance.
      '--headless',
      '--disable-gpu',
      '--disable-extensions',
      '--disable-background-networking',
      '--disable-component-extensions-with-background-pages',
      '--disable-sync',
      '--disable-default-apps',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-pdf-header-footer',
      `--user-data-dir=${userDataDir}`,
      `--print-to-pdf=${outPdf}`,
      pathToFileURL(htmlPath).href,
    ],
    { stdio: ['ignore', 'ignore', 'inherit'], timeout: 90_000 },
  )

  if (result.status !== 0 || !existsSync(outPdf)) {
    console.error(`✗ Chrome failed to produce a PDF (exit ${result.status}).`)
    process.exit(1)
  }
  const bytes = statSync(outPdf).size
  log('')
  log(`✓ Experimental HTML/CSS PDF generated`)
  log(`  fixture : ${fixture}`)
  log(`  output  : ${outPdf}`)
  log(`  size    : ${(bytes / 1024).toFixed(1)} KB`)
  log('')
  log(`  This is EXPERIMENTAL. Current pdf-lib exports are unchanged.`)
  log(`  See docs/html-css-pdf-engine.md for the field-overlay roadmap.`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
