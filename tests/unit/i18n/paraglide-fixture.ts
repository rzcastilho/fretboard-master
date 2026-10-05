import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const BIN = resolve(process.cwd(), 'node_modules/.bin/paraglide-js');
const PLUGIN = 'https://cdn.jsdelivr.net/npm/@inlang/plugin-message-format@latest/dist/index.js';

export const FIXTURE_MESSAGES = {
  en: { greeting: 'Hello', farewell: 'Goodbye' },
  // `farewell` is deliberately missing from pt-BR.
  'pt-BR': { greeting: 'Olá' },
  es: { greeting: 'Hola', farewell: 'Adiós' }
} as const;

export interface CompiledFixture {
  dir: string;
  outdir: string;
}

/** Compiles a three-locale inlang project (one pt-BR key removed) into a temp dir. */
export function compileFixture(): CompiledFixture {
  const dir = mkdtempSync(join(tmpdir(), 'fm-paraglide-'));
  mkdirSync(join(dir, 'project.inlang'));
  mkdirSync(join(dir, 'messages'));
  writeFileSync(
    join(dir, 'project.inlang/settings.json'),
    JSON.stringify({
      baseLocale: 'en',
      locales: ['en', 'pt-BR', 'es'],
      modules: [PLUGIN],
      'plugin.inlang.messageFormat': { pathPattern: './messages/{locale}.json' }
    })
  );
  for (const [locale, messages] of Object.entries(FIXTURE_MESSAGES)) {
    writeFileSync(join(dir, `messages/${locale}.json`), JSON.stringify(messages));
  }
  const outdir = join(dir, 'paraglide');
  execFileSync(
    BIN,
    [
      'compile',
      '--project',
      join(dir, 'project.inlang'),
      '--outdir',
      outdir,
      '--strategy',
      'baseLocale',
      '--silent'
    ],
    { cwd: dir, stdio: 'pipe' }
  );
  return { dir, outdir };
}
