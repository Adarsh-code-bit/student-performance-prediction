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
      // Quick-Commerce Design Tokens
      colors: {
        brand: {
          yellow: '#F8CB46',
          'yellow-light': '#FDF3D0',
          'yellow-dark': '#D4A418',
          green: '#168A45',
          'green-light': '#E8F5ED',
          'green-dark': '#0F6531',
          forest: '#12372A',
          'forest-light': '#1A4D3B',
          'forest-dark': '#0B231B',
        },
        workspace: '#F7F8F5',
        card: '#FFFFFF',
        'text-main': '#17211B',
        'text-muted': '#68736B',
        'border-ui': '#E5E9E4',
        // Semantic aliases
        success: '#168A45',
        'success-bg': '#E8F5ED',
        warning: '#E9A23B',
        'warning-bg': '#FEF6EB',
        critical: '#DC3545',
        'critical-bg': '#FDF2F2',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
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
