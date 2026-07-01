import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Literal hex so Tailwind's /opacity modifier works. CSS vars in
        // globals.css mirror these for raw CSS / inline styles.
        paper: "#ece7db",
        "paper-2": "#e3ddcd",
        ink: "#16130d",
        "ink-soft": "#4a4639",
        accent: "#ff4a1c",
        sev: {
          critico: "#c4170c",
          serio: "#b25e00",
          moderato: "#5f6310",
          minore: "#155e6b",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderWidth: {
        3: "3px",
      },
    },
  },
  plugins: [],
};
export default config;
