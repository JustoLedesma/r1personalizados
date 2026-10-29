/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.js',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#a37cfc',
          hover: '#8f63f5',
          active: '#7c4de8',
          soft: '#efe8ff',
        },
        danger: {
          DEFAULT: '#dc2626',
          hover: '#b91c1c',
        },
      },
    },
  },
  plugins: [],
};

