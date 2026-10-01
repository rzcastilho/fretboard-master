// Builds static/fonts/fm-accidentals.woff2: Noto Music subset to ♭ ♮ ♯ 𝄪 𝄫 (ADR 0006).
// Usage: pnpm fonts:accidentals
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import subsetFont from 'subset-font';

const require = createRequire(import.meta.url);
const pkgDir = dirname(require.resolve('@fontsource/noto-music/package.json'));
const source = readFileSync(join(pkgDir, 'files', 'noto-music-music-400-normal.woff2'));

const GLYPHS = '♭♮♯\u{1D12A}\u{1D12B}';
const out = await subsetFont(source, GLYPHS, { targetFormat: 'woff2' });

mkdirSync('static/fonts', { recursive: true });
writeFileSync('static/fonts/fm-accidentals.woff2', out);
console.log(`static/fonts/fm-accidentals.woff2: ${out.length} bytes`);
