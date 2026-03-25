import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,ts,tsx,jsx}'],
  theme: {
    extend: {
      colors: {
        'bg-deep': 'rgb(var(--bg-deep) / <alpha-value>)',
        'bg-surface': 'rgb(var(--bg-surface) / <alpha-value>)',
        'bg-surface-hover': 'rgb(var(--bg-surface-hover) / <alpha-value>)',
        'border-subtle': 'rgb(var(--border-subtle) / <alpha-value>)',
        'code-bg': 'rgb(var(--code-bg) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          dark: '#10b981',
          dim: 'rgb(var(--accent) / 0.08)',
          glow: 'rgb(var(--accent) / 0.15)',
        },
        'tag-bg': 'rgb(var(--tag-bg) / <alpha-value>)',
        'tag-text': 'rgb(var(--tag-text) / <alpha-value>)',
        'txt-primary': 'rgb(var(--txt-primary) / <alpha-value>)',
        'txt-secondary': 'rgb(var(--txt-secondary) / <alpha-value>)',
        'txt-muted': 'rgb(var(--txt-muted) / <alpha-value>)',
      },
      fontFamily: {
        mono: ['"JetBrains Mono"', 'monospace'],
        sans: ['Inter', 'sans-serif'],
        heading: ['Outfit', 'sans-serif'],
      },
      borderRadius: {
        'sm': '0.375rem',
        'md': '0.75rem',
        'lg': '1rem',
        'xl': '1.25rem',
      },
      animation: {
        'typewriter': 'typewriter 2s steps(14) forwards, blink 1s step-end infinite 2s',
        'fade-in-up': 'fade-in-up 0.6s ease-out forwards',
        'fade-in': 'fade-in 0.5s ease-out forwards',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'slide-in': 'slide-in 0.4s ease-out forwards',
        'bounce-slow': 'bounce-slow 2s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
      },
      keyframes: {
        'typewriter': {
          '0%': { width: '0' },
          '100%': { width: '100%' },
        },
        'blink': {
          '0%, 100%': { borderColor: 'transparent' },
          '50%': { borderColor: '#34d399' },
        },
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'glow-pulse': {
          '0%, 100%': { boxShadow: '0 0 5px rgba(52, 211, 153, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(52, 211, 153, 0.5)' },
        },
        'slide-in': {
          '0%': { opacity: '0', transform: 'translateX(-10px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'bounce-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
} satisfies Config
