import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileFixture } from './paraglide-fixture';

let messagesUrl: string;

/** Renders `key` for `locale` in a plain Node process (the fixture is outside Vite's graph). */
function render(key: string, locale: string): string {
  const script = `import(${JSON.stringify(messagesUrl)}).then((x) => process.stdout.write(x.m[${JSON.stringify(key)}]({}, { locale: ${JSON.stringify(locale)} })))`;
  return execFileSync(process.execPath, ['-e', script], { encoding: 'utf8' });
}

beforeAll(() => {
  const { outdir } = compileFixture();
  messagesUrl = pathToFileURL(join(outdir, 'messages.js')).href;
}, 60_000);

describe('Paraglide fallback (R-04)', () => {
  it('pt-BR falls back to English for the removed key', () => {
    expect(render('farewell', 'pt-BR')).toBe('Goodbye');
  });

  it('pt-BR keeps its own text for present keys', () => {
    expect(render('greeting', 'pt-BR')).toBe('Olá');
  });

  it('other locales keep their own text', () => {
    expect(render('farewell', 'es')).toBe('Adiós');
    expect(render('greeting', 'es')).toBe('Hola');
    expect(render('farewell', 'en')).toBe('Goodbye');
  });
});
