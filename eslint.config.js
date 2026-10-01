import js from '@eslint/js';
import globals from 'globals';
import svelte from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'build/',
      'build-next/',
      '.svelte-kit/',
      'src/lib/paraglide/',
      'playwright-report/',
      '.lighthouseci/',
      'coverage/',
      'node_modules/',
      'pnpm-lock.yaml',
      'specs/',
      '.specify/',
      '.claude/'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.strict,
  ...svelte.configs['flat/recommended'],
  {
    languageOptions: {
      globals: { ...globals.browser, ...globals.node, __APP_VERSION__: 'readonly' }
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }]
    }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { parser: tseslint.parser } }
  },
  {
    // R-15: theory modules are pure — no framework, DOM, or app-layer imports.
    files: ['src/lib/theory/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '$app/*',
            '$lib/paraglide/*',
            '$lib/prefs/*',
            '$lib/audio/*',
            '$lib/fretboard/*',
            '$lib/state/*'
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Theory code must be DOM-free.' },
        { name: 'document', message: 'Theory code must be DOM-free.' },
        { name: 'localStorage', message: 'Theory code must be DOM-free.' }
      ]
    }
  }
);
