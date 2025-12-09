/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Dark mode specific colors
        dark: {
          bg: '#0f172a',
          'bg-secondary': '#1e293b',
          card: '#1e293b',
          border: '#334155',
        }
      },
      backgroundColor: {
        'theme': 'var(--theme-bg)',
        'theme-secondary': 'var(--theme-bg-secondary)',
        'theme-card': 'var(--theme-bg-card)',
      },
      textColor: {
        'theme': 'var(--theme-text)',
        'theme-secondary': 'var(--theme-text-secondary)',
      },
      borderColor: {
        'theme': 'var(--theme-border)',
      },
      transitionProperty: {
        'theme': 'background-color, border-color, color, fill, stroke',
      }
    },
  },
  plugins: [],
}