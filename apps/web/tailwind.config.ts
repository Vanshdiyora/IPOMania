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
        navy: "#101828",
        "navy-secondary": "#1D2D44",
        "navy-light": "#253650",

        // ── Primary interactive ──────────────────────────────────────────────
        action: "#1D4ED8",
        "action-hover": "#1D4ED8",
        "action-light": "#EFF6FF",
        "action-border": "#BFDBFE",

        // ── Backgrounds ──────────────────────────────────────────────────────
        canvas: "#F8FAFC",
        surface: "#FFFFFF",
        "surface-elevated": "#FFFFFF",
        "surface-subtle": "#F1F5F9",

        // ── Text ─────────────────────────────────────────────────────────────
        ink: "#0F172A",
        "ink-secondary": "#334155",
        muted: "#475569",
        subtle: "#94A3B8",

        // ── Borders ──────────────────────────────────────────────────────────
        border: "#E2E8F0",
        "border-strong": "#CBD5E1",
        "border-focus": "#2563EB",

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

        // ── Chart palette ────────────────────────────────────────────────────
        "chart-1": "#2563EB",
        "chart-2": "#16A34A",
        "chart-3": "#D97706",
        "chart-4": "#DC2626",
        "chart-5": "#7C3AED",
        "chart-6": "#0284C7",
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
        card: "0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.04)",
        "card-hover": "0 4px 12px 0 rgb(0 0 0 / 0.08), 0 2px 4px -1px rgb(0 0 0 / 0.04)",
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
      },
      animation: {
        "fade-in": "fade-in 0.2s cubic-bezier(0.4, 0, 0.2, 1) both",
        "fade-out": "fade-out 0.15s cubic-bezier(0.4, 0, 0.2, 1) both",
        "slide-in-left": "slide-in-left 0.22s cubic-bezier(0.4, 0, 0.2, 1) both",
        "scale-in": "scale-in 0.18s cubic-bezier(0.4, 0, 0.2, 1) both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
