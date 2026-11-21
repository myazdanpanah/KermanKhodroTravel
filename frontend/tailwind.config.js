/** @type {import('tailwindcss').Config} */
// NEXIVO Design System v1.0.0
// Source of truth: src/design/tokens/*.json — never use raw hex values in components.
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Vazirmatn is self-hosted via @fontsource (see main.tsx)
        sans: ['Vazirmatn', 'system-ui', 'sans-serif'],
      },
      colors: {
        // color-palette.json
        'nx-navy': {
          DEFAULT: '#101D35', // Deep Navy — OS canvas
          elevated: '#1E2A42', // card-tokens.json → elevated background
          border: '#2C4060', // card-tokens.json → elevated border
        },
        // Runtime-themable accents: defaults live in index.css :root and are
        // overridden from Company branding (Settings → Branding).
        'nx-blue': 'rgb(var(--nx-blue) / <alpha-value>)', // Intelligence Blue — action signal
        'nx-teal': 'rgb(var(--nx-teal) / <alpha-value>)', // Digital Teal — status signal
        'nx-mist': '#A5B4CC', // Silver Mist — disabled / separators
        'nx-cream': '#F7F3EA', // warm light canvas — softer than pure white
        'nx-border': '#E5E7EB', // card-tokens.json → default border
        'nx-muted': '#6B7280', // button-tokens.json → disabled text
        // Status signals — color-palette.json → color.status. Semantic layer over
        // the hues the product already used, so existing screens keep their exact
        // look while status colouring stops depending on raw Tailwind palettes.
        'nx-danger': {
          50: '#FEF2F2', // error surface (light)
          100: '#FEE2E2', // error surface / badge (light)
          200: '#FECACA', // error border (light)
          300: '#FCA5A5', // error text (light, subtle) / dark badge text
          400: '#F87171', // error text (dark)
          500: '#EF4444', // error — base signal
          600: '#DC2626', // error — solid button / hover
          700: '#B91C1C', // error text (light, strong)
          800: '#991B1B',
          900: '#7F1D1D', // error surface (dark)
          950: '#450A0A', // error surface (dark, deep)
        },
        'nx-warning': {
          50: '#FFFBEB', // warning surface (light)
          100: '#FEF3C7', // warning surface / badge (light)
          200: '#FDE68A', // warning border (light)
          300: '#FCD34D', // warning text (dark, subtle)
          400: '#FBBF24', // warning text (dark) / icon
          500: '#F59E0B', // warning — base signal
          600: '#D97706', // warning — solid button / hover
          700: '#B45309', // warning text (light, strong)
          800: '#92400E',
          900: '#78350F', // warning surface (dark)
          950: '#451A03', // warning surface (dark, deep)
        },
      },
      borderRadius: {
        'nx-card': '12px', // card-tokens.json
        'nx-btn': '4px', // button-tokens.json
      },
      boxShadow: {
        'nx-card': '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.06)',
        'nx-elevated': '0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -4px rgba(0, 0, 0, 0.1)',
      },
    },
  },
  plugins: [],
}
