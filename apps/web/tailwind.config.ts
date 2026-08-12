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
        // Brand — values per the Kindred Mind Design Foundation
        // (docs/DESIGN_FOUNDATION.md) and the Onboarding & Dashboard
        // wireframe. brand-primary was #6C5CE7 — updated to the
        // slightly deeper, more vibrant #7C3AED (vivid violet) for the
        // 2026 dashboard refresh. purple-light is the soft wash
        // used for active icon-container backgrounds. deep-purple is
        // used for the community-status card gradient. soft-pink and
        // soft-amber are the new light-tint surfaces for the metrics
        // cards (Members = purple, Relationships = pink, Moments =
        // amber) — kept low-saturation so the cards feel calm.
        'brand-primary': '#7C3AED',
        'brand-primary-hover': '#6D28D9',
        'brand-primary-active': '#5B21B6',
        'deep-purple': '#5B21B6',
        'purple-light': '#EDE9FE',
        'soft-pink': '#FCE7F3',
        'soft-amber': '#FEF3C7',
        'soft-emerald': '#D1FAE5',
        coral: '#FF7A6B',
        'accent-gold': '#F6B73C',

        // Surfaces
        background: '#FFFFFF',
        surface: '#F8F9FC',
        border: '#E5E7EB',
        'border-strong': '#D1D5DB',

        // Text — text-primary was #111827 (gray-900), too dark for
        // the wireframe's soft slate feel. Now slate-800.
        'text-primary': '#1F2937',
        'text-secondary': '#6B7280',
        'text-muted': '#9CA3AF',

        // Status — success was #22C55E (green-500), the wireframe
        // uses the slightly deeper emerald-500 #10B981.
        success: '#10B981',
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
        card: '24px',
        container: '32px',
        code: '8px',
        '2xl': '1.25rem',
        '3xl': '1.75rem',
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
