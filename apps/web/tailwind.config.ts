import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#151311', soft: '#2a2622', muted: '#6f675e' },
        cream: { DEFAULT: '#f7f3ec', deep: '#ece5d8' },
        gold: { DEFAULT: '#b08d57', deep: '#8a6b3d', soft: '#e8dcc6' },
        good: '#2f7d4f',
        warn: '#a8641a',
        bad: '#b3372f',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
} satisfies Config;
