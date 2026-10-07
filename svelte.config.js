import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { readFileSync } from 'node:fs';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({ pages: 'build', assets: 'build' }),
    output: { bundleStrategy: 'single' },
    // Absolute asset URLs: the prerendered 404.html is served for deep paths like /triads/x.
    paths: { relative: false },
    inlineStyleThreshold: Infinity,
    typescript: {
      // 028: type-check the Cloudflare Pages Function (`functions/m.ts`) with `pnpm check`.
      config: (cfg) => ({ ...cfg, include: [...cfg.include, '../functions/**/*.ts'] })
    },
    version: { name: version, pollInterval: 0 },
    csp: {
      mode: 'hash',
      directives: {
        'default-src': ['self'],
        'script-src': ['self'],
        'style-src': ['self'],
        'img-src': ['self', 'data:'],
        'connect-src': ['self'],
        'object-src': ['none'],
        'base-uri': ['self'],
        'form-action': ['self']
      }
    }
  }
};

export default config;
