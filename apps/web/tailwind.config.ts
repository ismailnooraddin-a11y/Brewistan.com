import type { Config } from 'tailwindcss';

// Apple-inspired palette: soft grey canvas, near-black text, one blue accent.
// The token names (ink, cream, gold) are kept so every page picks up the new look.
export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#1d1d1f', soft: '#424245', muted: '#6e6e73' },
        cream: { DEFAULT: '#f5f5f7', deep: '#e8e8ed' },
        gold: { DEFAULT: '#0071e3', deep: '#0058b0', soft: '#e8f1fd' },
        good: '#1d8a3a',
        warn: '#b25000',
        bad: '#d70015',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        card: ['var(--font-card)', 'Georgia', 'serif'],
      },
      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.05)',
      },
    },
  },
  plugins: [],
} satisfies Config;
