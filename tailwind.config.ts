import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        pitch: {
          50: "#f0fdf4",
          100: "#dcfce7",
          300: "#86efac",
          400: "#4ade80",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          950: "#052e16"
        }
      },
      keyframes: {
        pulseRow: {
          "0%,100%": { backgroundColor: "rgba(34,197,94,0.0)" },
          "50%": { backgroundColor: "rgba(34,197,94,0.18)" }
        }
      },
      animation: { pulseRow: "pulseRow 1.2s ease-in-out" }
    }
  },
  plugins: []
};

export default config;
