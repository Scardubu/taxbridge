/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        brand:      { primary: '#006B3F', secondary: '#FFD700', accent: '#E8401C' },
        compliance: { shield: '#00C853', warning: '#FFB300', danger: '#D50000', pending: '#7C4DFF' },
        surface:    { DEFAULT: '#FFFFFF', dark: '#1A1A2E', card: '#F5F7FA', cardDark: '#16213E' },
        text:       { primary: '#1A1A2E', secondary: '#5A6A7A', muted: '#8A9BB0' },
        // Legacy aliases kept for existing src/ screens
        primary:  { DEFAULT: '#006B3F', light: '#00A86B', dark: '#004D2D' },
        danger:   '#E8401C',
        warning:  '#FFB300',
        success:  '#00C853',
      },
    },
  },
  plugins: [],
}
