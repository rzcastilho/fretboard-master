// Builds static/fonts/fm-timer-digits.woff2: DSEG7 Classic Bold subset to 0-9 and ":" (ADR 0032).
// Usage: pnpm fonts:timer-digits
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('dseg/package.json'));
const source = readFileSync(join(pkgDir, 'fonts', 'DSEG7-Classic', 'DSEG7Classic-Bold.woff2'));

const out = await subsetFont(source, '0123456789:', { targetFormat: 'woff2' });

mkdirSync('static/fonts', { recursive: true });
writeFileSync('static/fonts/fm-timer-digits.woff2', out);
console.log(`static/fonts/fm-timer-digits.woff2: ${out.length} bytes`);
