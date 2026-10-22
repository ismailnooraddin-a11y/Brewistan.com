import type { Config } from 'tailwindcss';

// Brewistan design tokens. Quiet, neutral, precise.
// Token names (ink, cream, gold) are kept for compatibility across pages:
//   cream = canvas / secondary surface, ink = text, gold = the restrained forest-green accent.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#202320', soft: '#3c413d', muted: '#686d69', faint: '#858b86' },
        cream: { DEFAULT: '#f7f7f5', deep: '#f2f3f1' },
        line: '#e5e8e4',
        gold: { DEFAULT: '#465d51', deep: '#354a3f', soft: '#e9eeea' },
        warm: '#a48a6c',
        good: '#3d7a55',
        warn: '#9a6418',
        bad: '#b23a30',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        card: ['var(--font-card)', 'Georgia', 'serif'],
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '8px',
        lg: '10px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        soft: '0 2px 10px rgba(20, 30, 24, 0.035)',
        pop: '0 8px 28px rgba(20, 30, 24, 0.10), 0 1px 3px rgba(20, 30, 24, 0.06)',
      },
      transitionDuration: { DEFAULT: '150ms' },
    },
  },
  plugins: [],
} satisfies Config;
