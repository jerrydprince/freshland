/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        white: 'var(--text-white)',
        black: 'var(--bg-black)',
        gold: {
          400: 'var(--brand-400, #E88B7A)',
          500: 'var(--brand-500, #DF6853)',
          600: 'var(--brand-600, #C95A46)',
        },
        brand: {
          400: 'var(--brand-400, #E88B7A)',
          500: 'var(--brand-500, #DF6853)',
          600: 'var(--brand-600, #C95A46)',
        },
        dark: {
          900: 'var(--bg-dark-900)',
          800: 'var(--bg-dark-800)',
          700: 'var(--bg-dark-700)',
          600: 'var(--bg-dark-600)',
        },
        gray: {
          300: 'var(--text-gray-300)',
          400: 'var(--text-gray-400)',
          500: 'var(--text-gray-500)',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      }
    },
  },
  plugins: [],
}
