import { readFileSync } from 'node:fs';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';
import { findMissingKeys, type Catalog } from './src/lib/i18n/gaps';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const readCatalog = (locale: string): Catalog =>
  JSON.parse(
    readFileSync(new URL(`./messages/${locale}.json`, import.meta.url), 'utf8')
  ) as Catalog;

/** Per-locale message keys still missing text (falls back to English); `en` is the base: always []. */
function missingText(): Record<'en' | 'pt-BR' | 'es', string[]> {
  const base = readCatalog('en');
  return {
    en: [],
    'pt-BR': findMissingKeys(base, readCatalog('pt-BR')),
    es: findMissingKeys(base, readCatalog('es'))
  };
}

/** Worker cap from an env value ("4" or "50%"), else the fallback. */
function workerCap(
  env: string | undefined,
  fallback: string | undefined
): number | string | undefined {
  if (!env) return fallback;
  return /^\d+$/.test(env) ? Number(env) : env;
}

export default defineConfig(({ mode }) => {
  const override = process.env.FM_APP_VERSION;
  if (override && mode !== 'test') {
    throw new Error('FM_APP_VERSION may only be set for `--mode test` builds.');
  }
  const version = mode === 'test' && override ? override : pkg.version;
  // 028 R-05: Vitest and `vite dev` send nothing; builds default to the same-origin `/m`.
  const measureEndpoint =
    process.env.VITEST || mode === 'development' ? '' : (process.env.FM_MEASURE_ENDPOINT ?? '/m');

  return {
    plugins: [
      sveltekit(),
      svelteTesting(),
      paraglideVitePlugin({
        project: './project.inlang',
        outdir: './src/lib/paraglide',
        strategy: ['baseLocale']
      })
    ],
    build: {
      // 026 R-01: keep `light-dark()` native. Below these versions the CSS minifier rewrites it
      // into its `--lightningcss-light/dark` toggle, which this stylesheet does not rely on.
      cssTarget: ['chrome123', 'firefox120', 'safari17.5']
    },
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __FM_FAULT_INJECTION__: JSON.stringify(mode === 'test' || mode === 'development'),
      __FM_MISSING_TEXT__: JSON.stringify(missingText()),
      __FM_MEASURE_ENDPOINT__: JSON.stringify(measureEndpoint)
    },
    test: {
      // Pure tests run in node; files that render or touch the DOM opt in with
      // `// @vitest-environment jsdom` (jsdom setup was ~36% of suite time).
      environment: 'node',
      // Several worktrees share one machine locally; cap workers so parallel runs do not
      // starve each other into timeouts. CI keeps the default. Override: VITEST_MAX_WORKERS.
      maxWorkers: workerCap(process.env.VITEST_MAX_WORKERS, process.env.CI ? undefined : '50%'),
      include: ['tests/unit/**/*.test.ts'],
      setupFiles: ['tests/unit/setup.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/lib/paraglide/**', 'src/**/*.d.ts', 'src/**/*.css', 'src/**/*.html'],
        thresholds: {
          lines: 80,
          branches: 80,
          'src/lib/theory/**': { lines: 95, branches: 95 }
        }
      }
    }
  };
});
