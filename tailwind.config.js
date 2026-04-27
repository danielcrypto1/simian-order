/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Underground palette: pure-black base, harsh electric accents.
        // The `ape-*` keys are kept (with new values) so existing class
        // references throughout the app remap automatically — no page-level
        // refactor needed.
        ape: {
          950: "#000000",
          900: "#050507",
          850: "#0a0a0e",
          800: "#10101a",
          700: "#16172a",
          600: "#1f2140",
          500: "#0040ff", // electric blue (primary accent)
          400: "#1d4dff",
          300: "#3a6bff",
          200: "#aaaadd",
          100: "#e8e8e8",
        },
        elec: "#0040ff",       // pure electric blue
        bleed: "#ff2d2d",      // harsh red accent
        bone: "#e8e8e8",       // off-white
        accent: { DEFAULT: "#0040ff", dim: "#0033cc" },
        ink: "#cfcfdc",
        mute: "#5a5a6a",
        border: "#1a1a28",
        panel: "#050507",
        panelAlt: "#0a0a0e",
      },
      fontFamily: {
        // Default body is now serif — Times sets the underground/cult tone.
        sans: ['"Times New Roman"', "Times", "Georgia", "serif"],
        serif: ['"Times New Roman"', "Times", "Georgia", "serif"],
        mono: ['"Courier New"', "Courier", "ui-monospace", "monospace"],
        // Pixel face for headers & captions. VT323 imported in globals.css.
        pixel: ['"VT323"', '"Courier New"', "monospace"],
        // Retained system stack for explicit "old UI" callouts.
        sys: ["Tahoma", "Verdana", "system-ui", "sans-serif"],
      },
      fontSize: {
        xxs: "10px",
        xxxs: "9px",
      },
      boxShadow: {
        // Hard, no soft fade.
        hard: "2px 2px 0 0 #000",
        harsh: "3px 3px 0 0 #0040ff",
        bleed: "2px 2px 0 0 #ff2d2d",
        inset: "inset 0 0 0 1px #1a1a28",
      },
      letterSpacing: {
        wider2: "0.18em",
        widest2: "0.28em",
      },
    },
  },
  plugins: [],
};
