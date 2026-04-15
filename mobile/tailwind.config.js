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
        brand:      { primary: '#1D9E75', secondary: '#FFD700', accent: '#34D399' },
        compliance: { shield: '#00C853', warning: '#FFB300', danger: '#D50000', pending: '#7C4DFF' },
        surface:    { DEFAULT: '#FFFFFF', dark: '#1A1A2E', card: '#F5F7FA', cardDark: '#16213E' },
        text:       { primary: '#1A1A2E', secondary: '#5A6A7A', muted: '#8A9BB0' },
        // Legacy aliases kept for existing src/ screens
        primary:  { DEFAULT: '#1D9E75', light: '#34D399', dark: '#0F6E56' },
        danger:   '#E8401C',
        warning:  '#FFB300',
        success:  '#00C853',
      },
    },
  },
  plugins: [],
}
