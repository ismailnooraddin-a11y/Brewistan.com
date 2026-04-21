import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-inter)",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
        display: [
          "var(--font-fraunces)",
          "ui-serif",
          "Georgia",
          "Cambria",
          "Times New Roman",
          "serif",
        ],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      colors: {
        // Deep, warm espresso ink
        ink: {
          DEFAULT: "#1A1410",
          soft: "#3D2F26",
          muted: "#6B5849",
          faint: "#A3917F",
        },
        // Warm cream papers
        paper: {
          DEFAULT: "#F6F1E8",
          card: "#FCF9F2",
          tint: "#EFE7D6",
          deep: "#E8DCC3",
        },
        // Borders — subtle warm
        line: {
          DEFAULT: "#E0D4BC",
          soft: "#EBE0CB",
          strong: "#C9B896",
        },
        // Accent — burnt amber / crema
        ember: {
          DEFAULT: "#B8532C",
          deep: "#8E3D1C",
          soft: "#D97748",
          glow: "#F3C48A",
        },
        // Brand dark
        brand: {
          DEFAULT: "#1A1410",
          hover: "#2D221B",
        },
      },
      borderRadius: {
        xl: "14px",
        "2xl": "18px",
        "3xl": "24px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(26,20,16,0.04), 0 2px 8px rgba(26,20,16,0.05)",
        lift: "0 12px 32px -8px rgba(26,20,16,0.18), 0 4px 12px rgba(26,20,16,0.08)",
        soft: "0 2px 12px rgba(26,20,16,0.06)",
        inset: "inset 0 1px 0 rgba(255,255,255,0.6)",
      },
      fontSize: {
        hero: ["clamp(48px, 8vw, 92px)", { lineHeight: "0.95", letterSpacing: "-0.035em", fontWeight: "500" }],
        display: ["clamp(36px, 5vw, 56px)", { lineHeight: "1.02", letterSpacing: "-0.03em", fontWeight: "500" }],
        h2: ["clamp(28px, 3.5vw, 40px)", { lineHeight: "1.1", letterSpacing: "-0.02em", fontWeight: "500" }],
        eyebrow: ["12px", { lineHeight: "1", letterSpacing: "0.18em", fontWeight: "600" }],
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "steam": {
          "0%": { opacity: "0", transform: "translateY(0) scaleX(1)" },
          "40%": { opacity: "0.7" },
          "100%": { opacity: "0", transform: "translateY(-18px) scaleX(1.4)" },
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "blink": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
      },
      animation: {
        "fade-up": "fade-up 560ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "fade-in": "fade-in 420ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "scale-in": "scale-in 260ms cubic-bezier(0.22, 1, 0.36, 1) both",
        "steam": "steam 3.2s ease-out infinite",
        "marquee": "marquee 42s linear infinite",
        "blink": "blink 1.1s step-end infinite",
      },
      transitionTimingFunction: {
        enter: "cubic-bezier(0.22, 1, 0.36, 1)",
        move: "cubic-bezier(0.25, 1, 0.5, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
