import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-inter)", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "sans-serif"],
      },
      colors: {
        ink: {
          DEFAULT: "#1C1917",
          soft: "#44403C",
          muted: "#78716C",
          faint: "#A8A29E",
        },
        paper: {
          DEFAULT: "#FAFAF9",
          card: "#FFFFFF",
          tint: "#F5F5F4",
        },
        line: {
          DEFAULT: "#E7E5E4",
          soft: "#F0EEEC",
        },
        brand: {
          DEFAULT: "#1C1917",
          hover: "#292524",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(0,0,0,0.04), 0 1px 1px rgba(0,0,0,0.03)",
        soft: "0 2px 8px rgba(28,25,23,0.06)",
      },
      fontSize: {
        hero: ["56px", { lineHeight: "1.05", letterSpacing: "-0.03em", fontWeight: "600" }],
        display: ["40px", { lineHeight: "1.1", letterSpacing: "-0.025em", fontWeight: "600" }],
        h2: ["28px", { lineHeight: "1.2", letterSpacing: "-0.015em", fontWeight: "600" }],
      },
    },
  },
  plugins: [],
};

export default config;
