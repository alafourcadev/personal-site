import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,ts}'],
  theme: {
    extend: {
      colors: {
        'bg-deep': '#0a0f1a',
        'bg-surface': '#131b2e',
        'bg-surface-hover': '#1a2540',
        'border-subtle': '#1e2d4a',
        'code-bg': '#0d1117',
        accent: {
          DEFAULT: '#34d399',
          dark: '#10b981',
          dim: 'rgba(52, 211, 153, 0.08)',
          glow: 'rgba(52, 211, 153, 0.15)',
        },
        'tag-bg': 'rgba(52, 211, 153, 0.08)',
        'tag-text': '#6ee7b7',
        'txt-primary': '#e2e8f0',
        'txt-secondary': '#94a3b8',
        'txt-muted': '#64748b',
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
