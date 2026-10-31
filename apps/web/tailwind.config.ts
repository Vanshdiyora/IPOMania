import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#1E3A5F",
        "navy-secondary": "#294C73",
        canvas: "#F5F7FA",
        ink: "#1F2937",
        muted: "#526071",
        border: "#D8DEE8",
        action: "#245A8D",
        success: "#237A4B",
        warning: "#A66A13",
        danger: "#B42318",
      },
      minHeight: {
        touch: "44px",
      },
      minWidth: {
        touch: "44px",
      },
    },
  },
  plugins: [],
};

export default config;
