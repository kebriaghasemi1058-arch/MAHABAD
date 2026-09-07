import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        stone: {
          DEFAULT: "rgb(var(--color-stone) / <alpha-value>)",
          dark: "rgb(var(--color-stone-dark) / <alpha-value>)",
        },
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        brick: "rgb(var(--color-brick) / <alpha-value>)",
        saffron: "rgb(var(--color-saffron) / <alpha-value>)",
        juniper: "rgb(var(--color-juniper) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        // Fixed label color for saturated accent buttons (bg-brick/
        // juniper/saffron) — those stay dark-saturated in both themes,
        // so their text must not flip the way canvas text does.
        oncolor: "#F5F0E6",
      },
      fontFamily: {
        sans: ["var(--font-vazir)", "Tahoma", "sans-serif"],
      },
      keyframes: {
        "gradient-shift": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "rise-in": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "sun-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.18)" },
          "100%": { transform: "scale(1)" },
        },
      },
      animation: {
        "gradient-shift": "gradient-shift 14s ease infinite",
        "rise-in": "rise-in 0.5s ease both",
        "sun-spin": "sun-spin 40s linear infinite",
        "pop": "pop 0.35s ease",
      },
    },
  },
  plugins: [],
};
export default config;
