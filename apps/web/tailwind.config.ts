import type { Config } from "tailwindcss";

// Design tokens locked in docs/architecture.md §6.2 — "focused exam room".
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B0C0E", // near-black
        paper: "#FAFAF7", // warm off-white
        teal: "#0FA37F", // your turn / live
        amber: "#E0A100", // AI thinking
        danger: "#D6453D", // error / disconnect
      },
      borderRadius: {
        DEFAULT: "8px",
        card: "12px",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      fontSize: {
        // 12 / 14 / 16 / 20 / 28 / 40 scale
        xs: "0.75rem",
        sm: "0.875rem",
        base: "1rem",
        xl: "1.25rem",
        "3xl": "1.75rem",
        "5xl": "2.5rem",
      },
    },
  },
  plugins: [],
} satisfies Config;
