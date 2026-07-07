import type { Config } from 'tailwindcss'

/**
 * Theme-aware palettes. Every scale referenced by app components resolves to
 * an RGB-channel CSS variable defined in styles.css, so dark mode flips the
 * whole UI by swapping variable values — no per-component dark: sprawl.
 *
 * The on-screen document preview and the generated PDF/DOCX intentionally do
 * NOT consume these variables: documents are always light/customer-ready.
 */
const channel = (name: string) => `rgb(var(--${name}) / <alpha-value>)`

const scale = (prefix: string, steps: number[]) =>
  Object.fromEntries(steps.map((s) => [s, channel(`${prefix}-${s}`)]))

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        slate: scale('c-slate', [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]),
        teal: {
          ...scale('c-teal', [50, 100, 200]),
          400: 'rgb(60 166 179 / <alpha-value>)',
          500: 'rgb(45 146 159 / <alpha-value>)',
          600: 'rgb(35 120 131 / <alpha-value>)',
          700: channel('c-teal-700'),
          800: channel('c-teal-800'),
        },
        amber: {
          ...scale('c-amber', [50, 100, 200]),
          500: 'rgb(245 158 11 / <alpha-value>)',
          600: channel('c-amber-600'),
          800: channel('c-amber-800'),
          900: channel('c-amber-900'),
        },
        emerald: scale('c-emerald', [50, 200, 700]),
        sky: scale('c-sky', [50, 200, 700]),
        purple: {
          400: 'rgb(134 100 255 / <alpha-value>)',
          500: 'rgb(105 85 212 / <alpha-value>)',
          600: 'rgb(98 59 236 / <alpha-value>)',
        },
        brand: {
          teal: 'rgb(60 166 179 / <alpha-value>)',
          tealDeep: 'rgb(15 163 181 / <alpha-value>)',
          tealBright: 'rgb(45 212 191 / <alpha-value>)',
          purple: 'rgb(98 59 236 / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        sans: ['DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Tenon', 'DM Sans', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        xs: '0 1px 2px rgba(15,23,42,0.04)',
        card: '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)',
        pop: '0 8px 24px rgba(15,23,42,0.12)',
      },
    },
  },
  plugins: [],
}

export default config
