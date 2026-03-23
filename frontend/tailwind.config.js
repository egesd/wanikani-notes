/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{svelte,js,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand
        'primary': '#b10075',
        'primary-container': '#de0094',
        'secondary': '#006398',
        'secondary-fixed': '#cce5ff',
        'tertiary': '#8e29b4',

        // Surfaces
        'surface-container-high': '#e8e8e9',
        'surface-container': '#eeeeef',
        'surface-container-low': '#f3f3f4',
        'surface-container-lowest': '#ffffff',

        // Text / foreground
        'on-surface': '#1a1c1d',
        'on-surface-variant': '#593f4a',
        'on-primary': '#ffffff',

        // Borders
        'outline': '#8d6f7b',
        'outline-variant': '#e1bdcb',

        // Feedback
        'error': '#ba1a1a',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        headline: ['Manrope', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        label: ['Plus Jakarta Sans', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        '2xl': '1rem',
        '3xl': '1.5rem',
        full: '9999px',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
