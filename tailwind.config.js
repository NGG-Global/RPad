/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Segoe UI"', 'Roboto', '"Noto Sans Hebrew"', '"Helvetica Neue"', 'Arial', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', '"Roboto Mono"', 'Menlo', 'Consolas', 'monospace'],
      },
      colors: {
        surface: { DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)', 2: 'rgb(var(--c-surface-2) / <alpha-value>)', 3: 'rgb(var(--c-surface-3) / <alpha-value>)' },
        ink: { DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)', 2: 'rgb(var(--c-ink-2) / <alpha-value>)', 3: 'rgb(var(--c-ink-3) / <alpha-value>)' },
        line: 'rgb(var(--c-line) / <alpha-value>)',
        accent: { DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)', soft: 'rgb(var(--c-accent-soft) / <alpha-value>)' },
        ok: 'rgb(var(--c-ok) / <alpha-value>)',
        warn: 'rgb(var(--c-warn) / <alpha-value>)',
        err: 'rgb(var(--c-err) / <alpha-value>)',
      },
    },
  },
  plugins: [],
};
