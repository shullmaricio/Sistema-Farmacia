/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        tinta: '#12263A',
        'tinta-suave': '#3D5A73',
        papel: '#F1F4F7',
        borde: '#DDE4EA',
        farmacia: '#0B7A6B',
        'farmacia-oscuro': '#095E52',
        'farmacia-claro': '#E3F2EF',
        ambar: '#B45309',
        'ambar-claro': '#FEF3E2',
        peligro: '#B42318',
        'peligro-claro': '#FDECEA',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        barra: '0 -1px 0 0 #DDE4EA',
      },
    },
  },
  plugins: [],
}
