import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2] ?? 'build';
const needles = [
  '__fmFault',
  'Injected fault',
  '__fmFretboardFixture',
  '__fmFretboardEvents',
  '__fmAudioFault',
  '__fmAudioLog',
  '__fmInstrument'
];
const hits = [];

function walk(current) {
  for (const entry of readdirSync(current)) {
    const path = join(current, entry);
    if (statSync(path).isDirectory()) walk(path);
    else {
      const text = readFileSync(path, 'utf8');
      for (const needle of needles) if (text.includes(needle)) hits.push(`${path}: ${needle}`);
    }
  }
}

walk(dir);
if (hits.length > 0) {
  console.error(`FAIL: fault hook found in ${dir}/\n${hits.join('\n')}`);
  process.exit(1);
}
console.log(`OK: no fault hook in ${dir}/`);
