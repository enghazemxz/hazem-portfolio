const forms = require('@tailwindcss/forms');

module.exports = {
  darkMode: 'class',
  content: [
    './public-src/index.html',
    './public-src/*.js'
  ],
  theme: {
    extend: {
      colors: {
        'outline-variant': '#464555',
        secondary: '#b5c8df',
        'primary-container': '#645af6',
        'inverse-primary': '#4f44e2',
        'primary-fixed-dim': '#c4c0ff',
        'on-secondary': '#203243',
        primary: '#c4c0ff',
        'on-primary': '#2000a4',
        'on-background': '#dae2fd',
        'surface-variant': '#2d3449',
        'on-surface-variant': '#c7c4d7',
        outline: '#908fa0',
        'surface-container-highest': '#2d3449',
        'surface-container-high': '#222a3d',
        surface: '#0b1326',
        background: '#0b1326',
        'secondary-container': '#36485b',
        'surface-container-low': '#131b2e',
        'surface-bright': '#31394d',
        'surface-container': '#171f33',
        'on-surface': '#dae2fd',
        'on-secondary-container': '#a4b7cd',
        'surface-dim': '#0b1326',
        'on-primary-container': '#fbf6ff',
        'surface-container-lowest': '#060e20',
        tertiary: '#ecb2ff',
        'tertiary-container': '#9d52bc'
      },
      fontFamily: {
        headline: ['Space Grotesk', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        label: ['Inter', 'sans-serif']
      },
      borderRadius: {
        DEFAULT: '1rem',
        lg: '2rem',
        xl: '3rem',
        full: '9999px'
      }
    }
  },
  plugins: [forms]
};
