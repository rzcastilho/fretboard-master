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
      globals: {
        ...globals.browser,
        ...globals.node,
        __APP_VERSION__: 'readonly',
        __FM_FAULT_INJECTION__: 'readonly',
        __FM_MEASURE_ENDPOINT__: 'readonly'
      }
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
            '$lib/state/*',
            '$lib/instrument/*',
            '$lib/notation/*'
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
  },
  {
    files: ['src/lib/instrument/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '$app/*',
            '$lib/paraglide/*',
            '$lib/fretboard/*',
            '$lib/notation/*',
            '$lib/prefs/*',
            '$lib/audio/engine'
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Instrument code must be DOM-free.' },
        { name: 'document', message: 'Instrument code must be DOM-free.' },
        { name: 'localStorage', message: 'Instrument code must be DOM-free.' },
        { name: 'navigator', message: 'Instrument code must be DOM-free.' }
      ]
    }
  },
  {
    // Link codec is pure and language-free (specs/022 R-01).
    files: ['src/lib/link/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '$app/*',
            '$lib/paraglide/*',
            '$lib/notation/*',
            '$lib/prefs/*',
            '$lib/shell/*'
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Link codec must be DOM-free.' },
        { name: 'document', message: 'Link codec must be DOM-free.' },
        { name: 'navigator', message: 'Link codec must be DOM-free.' },
        { name: 'location', message: 'Link codec must be DOM-free.' },
        { name: 'history', message: 'Link codec must be DOM-free.' }
      ]
    }
  },
  {
    files: ['src/lib/notation/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '$app/*',
            '$lib/fretboard/*',
            '$lib/instrument/*',
            '$lib/prefs/*',
            '$lib/audio/engine'
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Notation code must be DOM-free.' },
        { name: 'document', message: 'Notation code must be DOM-free.' },
        { name: 'localStorage', message: 'Notation code must be DOM-free.' },
        { name: 'navigator', message: 'Notation code must be DOM-free.' }
      ]
    }
  },
  {
    files: ['src/lib/i18n/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '$app/*',
            '$lib/paraglide/*',
            '$lib/fretboard/*',
            '$lib/instrument/*',
            '$lib/prefs/*',
            '$lib/audio/engine'
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'i18n code must be DOM-free.' },
        { name: 'document', message: 'i18n code must be DOM-free.' },
        { name: 'localStorage', message: 'i18n code must be DOM-free.' },
        { name: 'navigator', message: 'i18n code must be DOM-free.' }
      ]
    }
  },
  {
    // Playback contract §4: audio is pure Web Audio/DSP; only state/playback owns the engine.
    files: ['src/lib/audio/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            'svelte',
            'svelte/*',
            '$app/*',
            '$lib/paraglide/*',
            '$lib/fretboard/*',
            '$lib/state/*',
            '$lib/shell/*',
            '$lib/prefs/*'
          ]
        }
      ]
    }
  },
  {
    files: ['src/lib/fretboard/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['$lib/audio/*', '$lib/state/*', '$lib/prefs/*'] }
      ]
    }
  },
  {
    // Only the playback state module may import the engine (contract §4).
    files: ['src/lib/state/**'],
    ignores: ['src/lib/state/playback.svelte.ts', 'src/lib/state/preferences.svelte.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['$lib/audio/engine', '$lib/prefs/*'] }]
    }
  },
  {
    // playback owns the engine but must not reach into prefs (the preferences store pushes values in).
    files: ['src/lib/state/playback.svelte.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: ['$lib/prefs/*'] }]
    }
  },
  {
    // 010 contracts/preferences-api.md §6 (R-12): prefs is a plain-TS layer. No framework, i18n,
    // app-state or shell value imports (type-only imports allowed); it never touches the engine.
    // Only state/preferences.svelte.ts and tests import $lib/prefs/*.
    files: ['src/lib/prefs/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['svelte', 'svelte/*'], allowTypeImports: true },
            { group: ['$app/*'], allowTypeImports: true },
            { group: ['$lib/paraglide/*'], allowTypeImports: true },
            { group: ['$lib/state/*'], allowTypeImports: true },
            { group: ['$lib/shell/*'], allowTypeImports: true },
            { group: ['$lib/audio/engine'] }
          ]
        }
      ]
    }
  },
  {
    // Shell and routes must not compute theory; go through instrument/fretboard.
    files: ['src/lib/shell/**', 'src/routes/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['$lib/theory/*', '$lib/audio/engine', '$lib/prefs/*'] }
      ]
    }
  },
  {
    // Tools consume state/instrument/fretboard; they never compute theory or touch the engine.
    files: ['src/lib/tools/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['$lib/theory/*', '$lib/audio/engine', '$lib/prefs/*'] }
      ]
    }
  },
  {
    // notes-view and links are pure: no framework, i18n, or DOM.
    files: ['src/lib/state/notes-view.ts', 'src/lib/state/links.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['svelte', 'svelte/*', '$lib/paraglide/*', '$lib/audio/engine', '$lib/prefs/*']
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'notes-view and links must be DOM-free.' },
        { name: 'document', message: 'notes-view and links must be DOM-free.' },
        { name: 'localStorage', message: 'notes-view and links must be DOM-free.' },
        { name: 'navigator', message: 'notes-view and links must be DOM-free.' }
      ]
    }
  },
  {
    // 040: the precache module is pure so the worker and unit tests share it.
    files: ['src/lib/offline/precache.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['svelte', 'svelte/*'] },
            { group: ['$app/*'] },
            { group: ['$lib', '$lib/*'], allowTypeImports: true }
          ]
        }
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'Precache code must be DOM-free.' },
        { name: 'document', message: 'Precache code must be DOM-free.' },
        { name: 'localStorage', message: 'Precache code must be storage-free.' },
        { name: 'sessionStorage', message: 'Precache code must be storage-free.' },
        { name: 'indexedDB', message: 'Precache code must be storage-free.' },
        { name: 'navigator', message: 'Precache code must be DOM-free.' }
      ]
    }
  },
  {
    // 040: the service worker runs in a worker scope, not a window.
    files: ['src/service-worker.ts'],
    languageOptions: {
      globals: { ...globals.serviceworker }
    }
  },
  {
    // 028: wire and sanitize are shared by the client and the `functions/m.ts` Pages Function,
    // so they import nothing from the app or framework (relative imports and valibot only).
    files: ['src/lib/measure/wire.ts', 'src/lib/measure/sanitize.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: ['$lib', '$lib/*', 'svelte', 'svelte/*', '$app', '$app/*', '$env', '$env/*'] }
      ]
    }
  }
);
