import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import { beforeAll, describe, expect, it } from 'vitest';
import { compileFixture } from './paraglide-fixture';

let dir: string;
let outdir: string;

function diagnose(file: string): readonly ts.Diagnostic[] {
  const program = ts.createProgram([file], {
    strict: true,
    allowJs: true,
    checkJs: false,
    noEmit: true,
    skipLibCheck: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    types: []
  });
  return ts.getPreEmitDiagnostics(program).filter((d) => d.file?.fileName === file);
}

function write(name: string, body: string): string {
  const file = join(dir, name);
  writeFileSync(file, body);
  return file;
}

beforeAll(() => {
  ({ dir, outdir } = compileFixture());
}, 60_000);

describe('key missing from English fails type-check (US5-2)', () => {
  it('unknown key → TS2339', () => {
    const file = write(
      'unknown.ts',
      `import { m } from './paraglide/messages.js';\nm.not_a_key();\n`
    );
    const found = diagnose(file);
    expect(found.some((d) => d.code === 2339)).toBe(true);
    const text = found.map((d) => ts.flattenDiagnosticMessageText(d.messageText, '\n')).join('\n');
    expect(text).toContain("Property 'not_a_key' does not exist");
    expect(outdir).toContain(dir);
  }, 60_000);

  it('existing key → zero diagnostics', () => {
    const file = write('known.ts', `import { m } from './paraglide/messages.js';\nm.greeting();\n`);
    expect(diagnose(file)).toEqual([]);
  }, 60_000);
});
