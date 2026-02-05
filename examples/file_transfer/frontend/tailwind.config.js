/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  important: '#root',
  theme: {
    extend: {
      colors: {
        cyber: {
          bg: '#0a0b14',
          surface: '#121420',
          primary: '#00f0ff',
          secondary: '#7000ff',
          text: '#e0e6ed',
          muted: '#64748b',
          danger: '#ff003c',
          success: '#00ff9f'
        }
      }
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false,
  },
}
