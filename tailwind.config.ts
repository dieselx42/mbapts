import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}", "./lib/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#edf9ff",
          100: "#d4efff",
          200: "#b2e5ff",
          300: "#7ed4ff",
          400: "#43bcff",
          500: "#149cec",
          600: "#0d7fc7",
          700: "#1065a0",
          800: "#145683",
          900: "#16486d"
        }
      }
    }
  },
  plugins: []
};

export default config;
