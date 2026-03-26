/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          navy: '#0f2f63',
          royal: '#1e4fa8',
          sky: '#dbeafe',
          gold: '#c89b3c',
          cream: '#f7f3e8',
          ink: '#10213c',
        },
        primary: {
          50: '#eef4ff',
          100: '#dce8ff',
          200: '#bdd1ff',
          300: '#92b3fb',
          400: '#5d88ef',
          500: '#2f65d2',
          600: '#1e4fa8',
          700: '#173f87',
        },
        'sidebar-bg': '#0f2f63',
        'sidebar-hover': '#1c4588',
        'sidebar-active': '#2857a0',
        'attendance-present': '#10b981',
        'attendance-absent': '#ef4444',
        'attendance-late': '#f59e0b',
      },
      boxShadow: {
        card: '0 10px 24px rgba(16, 33, 60, 0.08)',
        sidebar: '0 20px 40px rgba(10, 31, 70, 0.34)',
      },
      animation: {
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
