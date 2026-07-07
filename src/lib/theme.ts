/**
 * Dark-mode preference. App chrome only — the document preview paper and all
 * generated PDF/DOCX output stay light regardless of theme.
 */
const THEME_KEY = 'quill-theme'

export type Theme = 'light' | 'dark'

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY)
    if (v === 'dark' || v === 'light') return v
  } catch {
    /* storage unavailable */
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches
    ? 'dark'
    : 'light'
}

export function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle('dark', theme === 'dark')
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    /* ignore */
  }
}

/** Call once before first render to avoid a light-mode flash. */
export function initTheme(): Theme {
  const theme = getStoredTheme()
  document.documentElement.classList.toggle('dark', theme === 'dark')
  return theme
}
