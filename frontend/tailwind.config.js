/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  // Important: disable Tailwind's preflight (CSS reset) so it does NOT
  // override the existing design system reset and custom properties in index.css
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      // Extend Tailwind's color palette with the project's primary indigo shades
      colors: {
        primary: {
          50:  '#EEF2FF',
          100: '#E0E7FF',
          200: '#C7D2FE',
          300: '#A5B4FC',
          400: '#818CF8',
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
          800: '#3730A3',
          900: '#312E81',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      borderRadius: {
        sm: '6px',
        md: '10px',
        lg: '14px',
        xl: '18px',
      },
      boxShadow: {
        sm: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        md: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
        lg: '0 10px 25px rgba(0,0,0,0.08), 0 4px 10px rgba(0,0,0,0.04)',
        xl: '0 20px 40px rgba(0,0,0,0.1)',
        '2xl': '0 25px 60px rgba(0,0,0,0.4), 0 8px 20px rgba(0,0,0,0.2)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'spin': 'spin 0.8s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
