import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          50: "#FDFBF7",
          100: "#F9F4EA",
          200: "#F1E8D7",
          300: "#E7D9BF",
        },
        coffee: {
          50: "#F5F1EC",
          100: "#E5DCD1",
          200: "#C9B9A7",
          300: "#A9906F",
          400: "#8A6E4C",
          500: "#6F5537",
          600: "#574027",
          700: "#3F2E1C",
          800: "#2A1E13",
          900: "#1B130C",
        },
        moss: {
          50: "#EEF3EC",
          100: "#D7E3D3",
          300: "#9CB795",
          500: "#4F7A48",
          600: "#3D6238",
          700: "#2E4B2B",
        },
        terracotta: {
          50: "#FBEEE8",
          100: "#F5D8C9",
          300: "#E2A382",
          500: "#C4683F",
          600: "#A75230",
          700: "#7F3E24",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Georgia", "serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(27,19,12,0.04), 0 8px 24px -12px rgba(27,19,12,0.18)",
        float: "0 12px 40px -16px rgba(27,19,12,0.35)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
      },
      animation: {
        "fade-in": "fade-in 220ms ease-out both",
        "slide-up": "slide-up 260ms cubic-bezier(0.22,1,0.36,1) both",
        "pulse-soft": "pulseSoft 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
