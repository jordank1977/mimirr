import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Hardcover-inspired color scheme
        background: {
          DEFAULT: '#0f1419', // Deep dark background
          card: '#1a1f2e', // Card background
          hover: '#252b3b', // Hover state
        },
        foreground: {
          DEFAULT: '#e4e6eb', // Main text
          muted: '#9ca3af', // Muted text
        },
        primary: {
          DEFAULT: '#8b5cf6', // Purple accent
          hover: '#7c3aed',
          light: '#a78bfa',
        },
        secondary: {
          DEFAULT: '#4f46e5', // Indigo
          hover: '#4338ca',
        },
        accent: {
          blue: '#3b82f6',
          green: '#10b981',
          yellow: '#f59e0b',
          red: '#ef4444',
        },
        border: {
          DEFAULT: '#2d3748',
          light: '#374151',
        },
      },
    },
  },
  plugins: [],
}
export default config
