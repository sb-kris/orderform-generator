/**
 * Heuristic check: does an uploaded customer-logo *filename* plausibly belong
 * to the customer whose legal name is on the form? Catches the embarrassing
 * mistake of attaching the wrong customer's logo before an export.
 *
 * Deliberately conservative — it only flags when there is *zero* token overlap
 * between the (de-suffixed) legal name and the filename, so it never nags on a
 * partial/abbreviated match. It is a warning, never a blocker.
 */

/** Corporate suffixes / filler words that carry no identifying signal. */
const STOP_WORDS = new Set([
  'inc',
  'llc',
  'corp',
  'corporation',
  'ltd',
  'limited',
  'company',
  'co',
  'plc',
  'gmbh',
  'sa',
  'ag',
  'pvt',
  'private',
  'the',
  'and',
  'group',
  'holdings',
  'logo',
  'logotype',
  'brand',
  'final',
  'copy',
  'transparent',
  'white',
  'black',
  'color',
  'colour',
  'rgb',
  'png',
  'jpg',
  'jpeg',
  'svg',
  'v1',
  'v2',
])

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, ' ')
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2 && !STOP_WORDS.has(t) && !/^\d+$/.test(t))
}

export type LogoMatchResult = {
  /** true when we can't judge (no logo, no filename, or no legal name). */
  indeterminate: boolean
  /** true when there is at least one shared meaningful token. */
  matches: boolean
  legalTokens: string[]
  fileTokens: string[]
}

export function checkLogoNameMatch(
  legalName: string | undefined,
  filename: string | undefined,
): LogoMatchResult {
  const legalTokens = tokenize(legalName ?? '')
  // Strip the extension before tokenizing the filename.
  const base = (filename ?? '').replace(/\.[a-z0-9]+$/i, '')
  const fileTokens = tokenize(base)

  if (!legalTokens.length || !fileTokens.length) {
    return { indeterminate: true, matches: false, legalTokens, fileTokens }
  }

  const legalSet = new Set(legalTokens)
  const matches = fileTokens.some((t) => {
    if (legalSet.has(t)) return true
    // Prefix match handles "acme" vs "acmecorp" style filenames.
    return legalTokens.some(
      (l) => (l.length >= 4 && t.startsWith(l)) || (t.length >= 4 && l.startsWith(t)),
    )
  })

  return { indeterminate: false, matches, legalTokens, fileTokens }
}
