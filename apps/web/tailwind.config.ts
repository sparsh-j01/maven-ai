import type { Config } from "tailwindcss";

// Design tokens — "Viva Board": one warm paper/dossier language, two themes
// (light cream, dark espresso). Colors resolve from CSS custom properties in
// globals.css as space-separated RGB triples, so `<alpha-value>` works and the
// whole palette flips on <html data-theme>. Roles are semantic, never literal.
export default {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ground: "rgb(var(--ground) / <alpha-value>)", // page
        panel: "rgb(var(--panel) / <alpha-value>)", // card / surface
        soft: "rgb(var(--soft) / <alpha-value>)", // inset / secondary
        fg: "rgb(var(--fg) / <alpha-value>)", // primary text
        muted: "rgb(var(--muted) / <alpha-value>)", // secondary text
        accent: "rgb(var(--accent) / <alpha-value>)", // brick — brand / CTA
        teal: "rgb(var(--teal) / <alpha-value>)", // your turn / live
        amber: "rgb(var(--amber) / <alpha-value>)", // AI thinking
        danger: "rgb(var(--danger) / <alpha-value>)", // error / disconnect
        "on-accent": "rgb(var(--on-accent) / <alpha-value>)", // text on cobalt
        hair: "rgb(var(--hair) / <alpha-value>)", // hairline rule
      },
      borderRadius: {
        // Editorial-crisp: small radii, not glass-round.
        DEFAULT: "4px",
        card: "6px",
        xl: "10px",
      },
      fontFamily: {
        // Geist body sans (not Inter — avoids the AI-default face).
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Fraunces — the editorial serif for headlines, wordmark, and quotes.
        display: ["var(--font-display)", "Georgia", "serif"],
        serif: ["var(--font-display)", "Georgia", "serif"],
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
