import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        system: {
          dark: '#05070b',
          panel: '#0c1018',
          border: '#1d2736',
          blue: '#00f0ff'
        }
      }
    }
  },
  plugins: []
};

export default config;
