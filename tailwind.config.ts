import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        signal: {
          DEFAULT: '#0de8e1',
          50: '#e6fffe',
          100: '#c0fffd',
          200: '#80fffb',
          300: '#40fff9',
          400: '#0de8e1',
          500: '#0de8e1',
          600: '#0bbab5',
          700: '#098c89',
          800: '#075e5c',
          900: '#04302f',
        },
      },
    },
  },
  plugins: [],
};

export default config;
