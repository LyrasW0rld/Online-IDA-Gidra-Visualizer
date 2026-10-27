/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./services/**/*.{js,ts,jsx,tsx}"
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        taxiYellow: '#D4B483',
        sandAccent: '#D4B483',
        sandHover: '#E2C9A5',
        darkBg: '#090A0D',
        panelBg: '#0E1017'
      }
    },
  },
  plugins: [],
};
