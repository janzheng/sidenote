/** @type {import('tailwindcss').Config} */

export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'logo-gray': '#383838',
        // 'paper': '#F6F6EF',
        'paper': '#f9f9f9',
      },
      fontFamily: {
        // 'drafting': ['Drafting', 'system-ui', 'sans-serif'],
        'tabular': ['Tabular', 'system-ui', 'sans-serif'],
        'eb-garamond': ['EB Garamond Variable', 'serif'],
      },
    },
  },
}