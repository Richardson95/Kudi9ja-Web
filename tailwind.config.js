import defaultTheme from 'tailwindcss/defaultTheme';

/** Every colour is a CSS variable, so one class means gold-on-black in the
 *  dark theme and ink-on-warm-white in the light one (see src/index.css). */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gold: { DEFAULT: token('gold'), deep: token('gold-deep'), soft: token('gold-soft') },
        canvas: token('canvas'),
        surface: { DEFAULT: token('surface'), alt: token('surface-alt'), high: token('surface-high') },
        stroke: token('stroke'),
        ink: { DEFAULT: token('ink'), 2: token('ink-2'), 3: token('ink-3') },
        'on-gold': token('on-gold'),
        success: token('success'),
        danger: token('danger'),
        info: token('info'),
      },
      fontFamily: {
        sans: ['Figtree', ...defaultTheme.fontFamily.sans],
        mono: ['"JetBrains Mono"', ...defaultTheme.fontFamily.mono],
      },
      opacity: {
        7: '0.07',
        12: '0.12',
        35: '0.35',
        45: '0.45',
        55: '0.55',
        85: '0.85',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
      },
      boxShadow: {
        card: '0 1px 0 rgb(255 255 255 / 0.03) inset, 0 18px 40px -24px rgb(0 0 0 / 0.55)',
        gold: '0 14px 34px -14px rgb(var(--gold) / 0.55)',
        pop: '0 24px 60px -20px rgb(0 0 0 / 0.6)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'rise': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'none' },
        },
        'pop-in': {
          '0%': { opacity: '0', transform: 'scale(0.6)' },
          '60%': { opacity: '1', transform: 'scale(1.06)' },
          '100%': { transform: 'scale(1)' },
        },
        'sheet-in': {
          from: { opacity: '0', transform: 'translateY(28px) scale(0.985)' },
          to: { opacity: '1', transform: 'none' },
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '20%,60%': { transform: 'translateX(-8px)' },
          '40%,80%': { transform: 'translateX(8px)' },
        },
        'spin-slow': { to: { transform: 'rotate(360deg)' } },
        glow: {
          '0%,100%': { opacity: '0.55', transform: 'scale(1)' },
          '50%': { opacity: '1', transform: 'scale(1.08)' },
        },
        shimmer: { to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        'fade-in': 'fade-in .25s ease-out both',
        rise: 'rise .45s cubic-bezier(.2,.8,.2,1) both',
        'pop-in': 'pop-in .5s cubic-bezier(.2,.8,.2,1) both',
        'sheet-in': 'sheet-in .3s cubic-bezier(.2,.8,.2,1) both',
        shake: 'shake .42s ease-in-out',
        'spin-slow': 'spin-slow 2.4s linear infinite',
        glow: 'glow 3.2s ease-in-out infinite',
        shimmer: 'shimmer 1.4s linear infinite',
      },
    },
  },
  plugins: [],
};
