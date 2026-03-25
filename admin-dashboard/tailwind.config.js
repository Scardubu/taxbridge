/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // TaxBridge Brand Tokens
        brand: {
          primary: '#0B5FFF',
          'primary-dark': '#0952CC',
          'primary-light': '#EBF4FF',
          green: {
            400: '#22C55E',
            600: '#16A34A',
          },
          navy: '#071E2F',
        },
        tb: {
          success: '#10B981',
          'success-light': '#D1FAE5',
          warning: '#FBBF24',
          'warning-light': '#FEF3C7',
          error: '#DC2626',
          'error-light': '#FEE2E2',
          info: '#3B82F6',
          'info-light': '#DBEAFE',
        },
      },
      fontSize: {
        'tb-caption': ['12px', { lineHeight: '16px' }],
        'tb-body-sm': ['14px', { lineHeight: '20px' }],
        'tb-body': ['16px', { lineHeight: '24px' }],
        'tb-body-lg': ['18px', { lineHeight: '28px' }],
        'tb-h4': ['24px', { lineHeight: '32px', fontWeight: '600' }],
        'tb-h3': ['28px', { lineHeight: '36px', fontWeight: '700' }],
        'tb-h2': ['32px', { lineHeight: '40px', fontWeight: '700' }],
        'tb-h1': ['40px', { lineHeight: '48px', fontWeight: '700' }],
      },
      spacing: {
        'tb-xs': '4px',
        'tb-sm': '8px',
        'tb-md': '12px',
        'tb-lg': '16px',
        'tb-xl': '20px',
        'tb-2xl': '24px',
        'tb-3xl': '32px',
        'tb-4xl': '40px',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        'tb-sm': '0px 1px 2px rgba(0, 0, 0, 0.05)',
        'tb-md': '0px 2px 4px rgba(0, 0, 0, 0.06), 0px 1px 2px rgba(0, 0, 0, 0.03)',
        'tb-lg': '0px 4px 8px rgba(0, 0, 0, 0.08), 0px 2px 4px rgba(0, 0, 0, 0.04)',
        'tb-primary': '0px 4px 12px rgba(11, 95, 255, 0.3)',
      },
      keyframes: {
        "accordion-down": {
          from: { height: 0 },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: 0 },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
