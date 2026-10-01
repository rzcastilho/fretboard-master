import { readFileSync } from 'node:fs';
import { paraglideVitePlugin } from '@inlang/paraglide-js';
import { sveltekit } from '@sveltejs/kit/vite';
import { svelteTesting } from '@testing-library/svelte/vite';
import { defineConfig } from 'vitest/config';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig(({ mode }) => {
  const override = process.env.FM_APP_VERSION;
  if (override && mode !== 'test') {
    throw new Error('FM_APP_VERSION may only be set for `--mode test` builds.');
  }
  const version = mode === 'test' && override ? override : pkg.version;

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
    define: {
      __APP_VERSION__: JSON.stringify(version),
      __FM_FAULT_INJECTION__: JSON.stringify(mode === 'test' || mode === 'development')
    },
    test: {
      environment: 'jsdom',
      include: ['tests/unit/**/*.test.ts'],
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/lib/paraglide/**', 'src/**/*.d.ts', 'src/**/*.css'],
        thresholds: {
          lines: 80,
          branches: 80,
          'src/lib/theory/**': { lines: 95, branches: 95 }
        }
      }
    }
  };
});
