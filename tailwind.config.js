/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          950: '#141514',
          900: '#1C1E1C',
          800: '#2A2D2A',
          700: '#3D413D',
          600: '#565B56',
          500: '#727872',
          400: '#95998F',
          300: '#B9BCB4',
          200: '#DBDDD7',
          100: '#EDEFEA',
          50: '#F7F8F5',
        },
        pine: {
          900: '#0B3D34',
          800: '#0F4F44',
          700: '#136255',
          600: '#177566',
          500: '#1B8878',
          400: '#3DA491',
          300: '#7BC2B4',
          100: '#DCF0EB',
          50: '#EFF8F6',
        },
        amber: {
          600: '#B5790A',
          500: '#D2920F',
          100: '#FBEACB',
          50: '#FDF5E7',
        },
        clay: {
          600: '#B14B3C',
          500: '#C65D4C',
          100: '#F7DFDA',
          50: '#FCF0EE',
        },
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(20, 21, 20, 0.06), 0 1px 6px -1px rgba(20, 21, 20, 0.05)',
      },
      borderRadius: {
        card: '10px',
      },
    },
  },
  plugins: [],
}
