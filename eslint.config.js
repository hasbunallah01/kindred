// Root ESLint configuration (flat config).
// Shared by every workspace that extends the root setup.
// Framework-specific plugins (Next.js) are added by individual packages
// when needed; this base stays framework-agnostic and works for both
// apps/web (browser) and apps/agent (Node).

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.next/**',
      '**/coverage/**',
      '**/*.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts,tsx,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        // Node.js globals (the agent runtime is Node).
        // Web app-specific globals (window, document) are added by apps/web
        // when scaffolded.
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly',
        queueMicrotask: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
      },
    },
    rules: {
      // TS handles these; the TS plugin's rules are the source of truth.
      'no-unused-vars': 'off',
    },
  },
];
