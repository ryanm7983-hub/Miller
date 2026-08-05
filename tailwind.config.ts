import type { Config } from 'tailwindcss';

/**
 * AuditReady design system.
 *
 * Identity: calm, precise, trustworthy. Deep teal ("kelp") as the brand signal
 * against cool ink neutrals, with a fixed status palette that is used
 * consistently across readiness, requirement state, risk and gap severity.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kelp: {
          50: '#EDFBF7',
          100: '#D2F5EB',
          200: '#A8EAD8',
          300: '#71D8C0',
          400: '#3ABDA3',
          500: '#16A088',
          600: '#0B806E',
          700: '#0A6659',
          800: '#0B5148',
          900: '#0B433C',
          950: '#032722',
        },
        ink: {
          50: '#F7F8FA',
          100: '#EFF1F5',
          200: '#E2E6EC',
          300: '#CBD2DC',
          400: '#98A3B3',
          500: '#6B7788',
          600: '#4E5969',
          700: '#3A4353',
          800: '#232B38',
          900: '#151B26',
          950: '#0B1017',
        },
        strong: {
          50: '#ECFDF3',
          100: '#D1FADF',
          500: '#12B76A',
          600: '#039855',
          700: '#027A48',
        },
        caution: {
          50: '#FFFAEB',
          100: '#FEF0C7',
          500: '#F79009',
          600: '#DC6803',
          700: '#B54708',
        },
        risk: {
          50: '#FEF3F2',
          100: '#FEE4E2',
          500: '#F04438',
          600: '#D92D20',
          700: '#B42318',
        },
        info: {
          50: '#EFF8FF',
          100: '#D1E9FF',
          500: '#2E90FA',
          600: '#1570EF',
          700: '#175CD3',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      boxShadow: {
        xs: '0 1px 2px 0 rgb(11 16 23 / 0.05)',
        sm: '0 1px 3px 0 rgb(11 16 23 / 0.07), 0 1px 2px -1px rgb(11 16 23 / 0.04)',
        md: '0 4px 12px -2px rgb(11 16 23 / 0.08), 0 2px 4px -2px rgb(11 16 23 / 0.04)',
        lg: '0 12px 28px -8px rgb(11 16 23 / 0.12), 0 4px 10px -4px rgb(11 16 23 / 0.06)',
        xl: '0 24px 56px -16px rgb(11 16 23 / 0.18), 0 8px 20px -8px rgb(11 16 23 / 0.08)',
        panel: '0 0 0 1px rgb(11 16 23 / 0.06), 0 8px 24px -8px rgb(11 16 23 / 0.10)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fade-in 0.3s ease both',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
