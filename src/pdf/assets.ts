/**
 * Static assets embedded into the PDF.
 *
 * Font strategy
 * -------------
 * - Body text uses **DM Sans** (SurveySparrow's body typeface, shipped as
 *   raw TTFs (converted from fontsource WOFFs — PDF viewers cannot parse
 *   WOFF-wrapped font programs even when pdf-lib accepts them) under `public/fonts/`). Embedded via fontkit. If the fetch
 *   or embed fails for any reason, we fall back to standard Helvetica so PDF
 *   generation never hard-fails on a missing asset.
 * - The display title and section headings use **Tenon XBold** (brand
 *   display face). Headings are short uppercase strings with no risky
 *   ligature pairs.
 * - Typed signatures render in **Great Vibes**, a formal calligraphic script
 *   that reads as a natural handwritten signature without looking childish.
 *
 * Note on the earlier "diäerent" bug: Tenon's `ff` ligature glyph carries a
 * broken Unicode mapping, so body copy through Tenon mis-rendered. DM Sans
 * has correct ligature metadata — verified by rendering the terms text
 * through PDFium and checking "different"/"effect" pixel output.
 *
 * Page-1 background
 * -----------------
 * `loadPageOneBackground` looks for `public/page1-background.png`. When the
 * marketing/brand team supplies an approved asset, dropping it in `public/`
 * makes it appear behind page 1 at low opacity — no code change needed.
 * Absent that file, the renderer draws a subtle vector accent instead.
 */
import fontkit from '@pdf-lib/fontkit'
import type { PDFDocument, PDFFont, PDFImage } from 'pdf-lib'
import { StandardFonts } from 'pdf-lib'

const byteCache = new Map<string, Uint8Array>()

async function fetchBytes(url: string): Promise<Uint8Array> {
  const cached = byteCache.get(url)
  if (cached) return cached
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  byteCache.set(url, bytes)
  return bytes
}

export type PdfFonts = {
  regular: PDFFont
  medium: PDFFont
  bold: PDFFont
  oblique: PDFFont
  display: PDFFont // Tenon XBold – title / section headings only
  script: PDFFont | null // Great Vibes – typed signatures
}

export async function loadFonts(doc: PDFDocument): Promise<PdfFonts> {
  doc.registerFontkit(fontkit)

  const [helv, helvBold, helvOblique] = await Promise.all([
    doc.embedStandardFont(StandardFonts.Helvetica),
    doc.embedStandardFont(StandardFonts.HelveticaBold),
    doc.embedStandardFont(StandardFonts.HelveticaOblique),
  ])

  let regular = helv
  let medium = helvBold
  let bold = helvBold
  // `liga: false` is load-bearing: the fi/fl/ff ligature glyphs in these web
  // subsets carry glyph IDs that PDF viewers mis-render (e.g. "identi'ed").
  // Disabling ligature substitution keeps every letter as its own glyph.
  const noLiga = { features: { liga: false } }
  try {
    const [reg, med, bld] = await Promise.all([
      fetchBytes('/fonts/DMSans-Regular.ttf'),
      fetchBytes('/fonts/DMSans-Medium.ttf'),
      fetchBytes('/fonts/DMSans-Bold.ttf'),
    ])
    ;[regular, medium, bold] = await Promise.all([
      doc.embedFont(reg, noLiga),
      doc.embedFont(med, noLiga),
      doc.embedFont(bld, noLiga),
    ])
  } catch {
    // Helvetica fallback already assigned.
  }

  let display: PDFFont
  try {
    display = await doc.embedFont(await fetchBytes('/fonts/Tenon-XBold.otf'), noLiga)
  } catch {
    display = bold
  }

  let script: PDFFont | null = null
  try {
    // calt (contextual alternates) must be off too: Great Vibes' contextual
    // glyph forms hit the same broken-glyph-ID path as ligatures. Letters
    // lose their cursive joins but render correctly and stay legible.
    script = await doc.embedFont(await fetchBytes('/fonts/GreatVibes-Regular.ttf'), {
      features: { liga: false, calt: false, clig: false },
    })
  } catch {
    script = null
  }

  return { regular, medium, bold, oblique: helvOblique, display, script }
}

export async function loadSurveySparrowLogo(doc: PDFDocument): Promise<PDFImage> {
  return doc.embedPng(await fetchBytes('/surveysparrow-logo.png'))
}

/** Optional page-1 background. Returns null when no asset is deployed. */
export async function loadPageOneBackground(
  doc: PDFDocument,
): Promise<PDFImage | null> {
  try {
    return await doc.embedJpg(await fetchBytes('/page1-background.jpg'))
  } catch {
    /* fall through to PNG */
  }
  try {
    return await doc.embedPng(await fetchBytes('/page1-background.png'))
  } catch {
    return null
  }
}
