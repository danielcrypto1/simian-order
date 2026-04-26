/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ape: {
          950: "#020617",
          900: "#040a1f",
          850: "#061131",
          800: "#091a47",
          700: "#0d2563",
          600: "#11317f",
          500: "#1a45ad",
          400: "#3b6dd6",
          300: "#6a93e8",
          200: "#a9c2f0",
          100: "#d6e2f7",
        },
        accent: {
          DEFAULT: "#3b6dd6",
          dim: "#1a45ad",
        },
        ink: "#cfd8ec",
        mute: "#6a7da3",
        border: "#1a2a55",
        panel: "#06112e",
        panelAlt: "#091638",
      },
      fontFamily: {
        sans: ["Tahoma", "Verdana", "Geneva", "sans-serif"],
        mono: ["Consolas", "Courier New", "monospace"],
      },
      fontSize: {
        xxs: "10px",
      },
      boxShadow: {
        hard: "2px 2px 0 0 #000",
        inset: "inset 1px 1px 0 #1a2a55",
      },
    },
  },
  plugins: [],
};
