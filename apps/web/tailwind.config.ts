import type { Config } from 'tailwindcss';

// Tailwind configuration for apps/web.
//
// All Kindred Mind design tokens live here as semantic color names
// (brand-primary, coral, accent-gold, etc.) so the page code reads
// `bg-brand-primary` / `text-coral` instead of hard-coded hex values.
// This is the easiest place to rebrand later — change a token here,
// every page that uses it updates.
//
// Token values are the official Kindred Mind Design Foundation
// (docs/DESIGN_FOUNDATION.md) values. Do not change them without
// updating the Foundation document.
const config: Config = {
  content: ['./app/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Brand
        'brand-primary': '#5B3CC4',
        'brand-primary-hover': '#4A2FA8',
        'brand-primary-active': '#3F278F',
        coral: '#FF7A6B',
        'accent-gold': '#F6B73C',

        // Surfaces
        background: '#FFFFFF',
        surface: '#F8F9FC',
        border: '#E5E7EB',
        'border-strong': '#D1D5DB',

        // Text
        'text-primary': '#111827',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',

        // Status
        success: '#22C55E',
        warning: '#F59E0B',
        danger: '#EF4444',
        info: '#3B82F6',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      borderRadius: {
        input: '14px',
        card: '20px',
        container: '24px',
        code: '8px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(0, 0, 0, 0.04)',
        md: '0 4px 12px rgba(0, 0, 0, 0.05)',
        lg: '0 8px 30px rgba(0, 0, 0, 0.06)',
        xl: '0 16px 48px rgba(0, 0, 0, 0.08)',
      },
      maxWidth: {
        marketing: '1200px',
        dashboard: '1280px',
        form: '480px',
        reading: '720px',
      },
    },
  },
  plugins: [],
};

export default config;
