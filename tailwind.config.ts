import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#f3f6f9",
          100: "#e3eaf1",
          200: "#c7d6e3",
          300: "#9db8cd",
          400: "#6c92b1",
          500: "#4a7396",
          600: "#395b7b",
          700: "#304a64",
          800: "#2b3f54",
          900: "#1d2b3a",
          950: "#111a25",
        },
        accent: {
          400: "#f0b429",
          500: "#de911d",
          600: "#cb6e17",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "Segoe UI", "Roboto", "Helvetica", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
