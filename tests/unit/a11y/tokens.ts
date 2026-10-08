/**
 * Token-sheet parser for the accessibility tests.
 *
 * Reads `src/lib/styles/tokens.css` and returns the custom-property map of each block the theme
 * work cares about, plus a resolver for `light-dark(a, b)`. Colour maths live in `./color`
 * (contrast, CVD simulation, CIEDE2000); this file adds no dependency.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type TokenMap = Readonly<Record<string, string>>;

export interface TokenSheet {
  /** `:root` declarations (outside any at-rule). */
  readonly root: TokenMap;
  /** `[data-theme='x']` / `:root[data-theme='x']` declarations, keyed by the theme value. */
  readonly dataTheme: Readonly<Record<string, TokenMap>>;
  /** `@media (prefers-color-scheme: dark)` declarations. */
  readonly colorSchemeDark: TokenMap;
  /** `@media (prefers-contrast: more)` declarations. */
  readonly contrastMore: TokenMap;
  /** `@media (forced-colors: active)` declarations. */
  readonly forcedColors: TokenMap;
  /** `@media print` declarations. */
  readonly print: TokenMap;
}

const TOKENS_PATH = resolve(import.meta.dirname, '../../../src/lib/styles/tokens.css');

interface Rule {
  /** Selector, or the at-rule prelude (`@media ...`), trimmed. */
  readonly prelude: string;
  /** Raw body between the braces. */
  readonly body: string;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

/** Split `css` into its top-level `prelude { body }` rules (brace-aware). */
function topLevelRules(css: string): Rule[] {
  const rules: Rule[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = -1;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i];
    if (ch === '{') {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        rules.push({
          prelude: css.slice(start, bodyStart - 1).trim(),
          body: css.slice(bodyStart, i)
        });
        start = i + 1;
      }
    }
  }
  return rules;
}

/** Custom properties declared directly in `body` (nested rules are ignored). */
function declarations(body: string): Record<string, string> {
  const flat = topLevelRules(body).reduce(
    (text, r) => text.replace(`${r.prelude}{${r.body}}`, ''),
    body
  );
  const out: Record<string, string> = {};
  let depth = 0;
  let current = '';
  const flush = () => {
    const colon = current.indexOf(':');
    if (colon > 0) {
      const name = current.slice(0, colon).trim();
      if (name.startsWith('--')) out[name] = current.slice(colon + 1).trim();
    }
    current = '';
  };
  for (const ch of flat) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ';' && depth === 0) flush();
    else current += ch;
  }
  flush();
  return out;
}

/** Merge the declarations of every rule inside an at-rule body (any selector). */
function mergedDeclarations(body: string): Record<string, string> {
  const inner = topLevelRules(body);
  const out: Record<string, string> = { ...declarations(body) };
  for (const r of inner) Object.assign(out, declarations(r.body));
  return out;
}

const normalise = (s: string): string => s.replace(/\s+/g, ' ').toLowerCase();

const THEME_SELECTOR = /\[data-theme\s*=\s*["']?([\w-]+)["']?\]/;

export function parseTokenSheet(css: string = readFileSync(TOKENS_PATH, 'utf8')): TokenSheet {
  const root: Record<string, string> = {};
  const dataTheme: Record<string, Record<string, string>> = {};
  const media = {
    colorSchemeDark: {} as Record<string, string>,
    contrastMore: {} as Record<string, string>,
    forcedColors: {} as Record<string, string>,
    print: {} as Record<string, string>
  };

  const visit = (rules: Rule[]): void => {
    for (const rule of rules) {
      const prelude = normalise(rule.prelude);
      if (prelude.startsWith('@media')) {
        if (/prefers-color-scheme:\s*dark/.test(prelude)) {
          Object.assign(media.colorSchemeDark, mergedDeclarations(rule.body));
        } else if (/prefers-contrast:\s*more/.test(prelude)) {
          Object.assign(media.contrastMore, mergedDeclarations(rule.body));
        } else if (/forced-colors:\s*active/.test(prelude)) {
          Object.assign(media.forcedColors, mergedDeclarations(rule.body));
        } else if (/^@media\s+print\b/.test(prelude) || /\bprint\b/.test(prelude)) {
          Object.assign(media.print, mergedDeclarations(rule.body));
        }
        continue;
      }
      const theme = THEME_SELECTOR.exec(rule.prelude);
      if (theme) {
        dataTheme[theme[1]] = { ...dataTheme[theme[1]], ...declarations(rule.body) };
      } else if (rule.prelude.split(',').some((s) => s.trim() === ':root')) {
        Object.assign(root, declarations(rule.body));
      }
    }
  };
  visit(topLevelRules(stripComments(css)));

  return { root, dataTheme, ...media };
}

/** Split `light-dark(a, b)` into `[a, b]`; a plain value resolves to `[v, v]`. */
export function resolveLightDark(value: string): readonly [string, string] {
  const v = value.trim();
  const m = /^light-dark\(([\s\S]*)\)$/i.exec(v);
  if (!m) return [v, v];
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of m[1]) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else current += ch;
  }
  args.push(current.trim());
  if (args.length !== 2) throw new Error(`light-dark() needs two arguments: ${value}`);
  return [args[0], args[1]];
}

/** Every custom-property name declared anywhere in the token sheet (all blocks and at-rules). */
export function declaredTokenNames(css: string = readFileSync(TOKENS_PATH, 'utf8')): Set<string> {
  const names = new Set<string>();
  for (const m of stripComments(css).matchAll(/(?:^|[;{}\s])(--[\w-]+)\s*:/g)) names.add(m[1]);
  return names;
}
