import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "sans-serif",
        ],
      },
      colors: {
        // ── Core brand ──────────────────────────────────────────────────────
        navy: "#101338",
        "navy-secondary": "#29265C",
        "navy-light": "#4B2CB8",

        // ── Primary interactive ──────────────────────────────────────────────
        action: "#4B0FE8",
        "action-hover": "#3909BB",
        "action-light": "#F0EBFF",
        "action-border": "#D8C9FF",
        "action-emerald": "#0D9488",

        // ── Backgrounds ──────────────────────────────────────────────────────
        canvas: "#F8F7FF",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        "surface-subtle": "#F4F1FF",

        // ── Text ─────────────────────────────────────────────────────────────
        ink: "#101338",
        "ink-secondary": "#343A66",
        muted: "#555D83",
        subtle: "#7D82A6",

        // ── Borders ──────────────────────────────────────────────────────────
        border: "#E5E1F5",
        "border-strong": "#C9BDEB",
        "border-focus": "#713CFF",

        // ── Semantic ─────────────────────────────────────────────────────────
        success: "#15803D",
        "success-bg": "#F0FDF4",
        "success-border": "#BBF7D0",

        warning: "#B45309",
        "warning-bg": "#FFFBEB",
        "warning-border": "#FDE68A",

        danger: "#DC2626",
        "danger-bg": "#FEF2F2",
        "danger-border": "#FECACA",

        info: "#0369A1",
        "info-bg": "#F0F9FF",
        "info-border": "#BAE6FD",
        listed: "#6D28D9",
        "listed-bg": "#EEE4FF",
        "listed-border": "#DDD6FE",

        // ── Chart palette ────────────────────────────────────────────────────
        "chart-1": "#4B0FE8",
        "chart-2": "#7B4DFF",
        "chart-3": "#B095FF",
        "chart-4": "#D6C8FF",
        "chart-5": "#6D28D9",
        "chart-6": "#AA83FF",
      },

      // ── Spacing ─────────────────────────────────────────────────────────────
      minHeight: {
        touch: "44px",
        "screen-minus-header": "calc(100vh - 4rem)",
      },
      minWidth: {
        touch: "44px",
      },

      // ── Border radius ────────────────────────────────────────────────────────
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
      },

      // ── Box shadow ────────────────────────────────────────────────────────────
      boxShadow: {
        card: "0 8px 24px -15px rgb(52 31 123 / 0.25), 0 2px 6px rgb(52 31 123 / 0.05)",
        "card-hover": "0 16px 34px -18px rgb(52 31 123 / 0.28), 0 4px 12px rgb(52 31 123 / 0.08)",
        dropdown: "0 4px 20px 0 rgb(0 0 0 / 0.1), 0 2px 8px -2px rgb(0 0 0 / 0.06)",
        button: "0 1px 2px 0 rgb(0 0 0 / 0.08)",
        modal: "0 20px 60px -10px rgb(0 0 0 / 0.2), 0 8px 24px -6px rgb(0 0 0 / 0.1)",
      },

      // ── Animations ───────────────────────────────────────────────────────────
      transitionTimingFunction: {
        spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        smooth: "cubic-bezier(0.4, 0, 0.2, 1)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-out": {
          from: { opacity: "1", transform: "translateY(0)" },
          to: { opacity: "0", transform: "translateY(4px)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-12px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.97)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        "toast-timer": {
          from: { transform: "scaleX(1)" },
          to: { transform: "scaleX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s cubic-bezier(0.4, 0, 0.2, 1) both",
        "fade-out": "fade-out 0.15s cubic-bezier(0.4, 0, 0.2, 1) both",
        "slide-in-left": "slide-in-left 0.22s cubic-bezier(0.4, 0, 0.2, 1) both",
        "scale-in": "scale-in 0.18s cubic-bezier(0.4, 0, 0.2, 1) both",
        shimmer: "shimmer 2s linear infinite",
        "toast-timer": "toast-timer 5s linear forwards",
      },
    },
  },
  plugins: [],
};

export default config;
