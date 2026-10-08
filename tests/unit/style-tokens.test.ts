import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';
import { declaredTokenNames } from './a11y/tokens';

/**
 * Component style lint (spec 029, contracts/style-lint.md): chrome in `src/**\/*.svelte` takes
 * every colour, size, weight and duration from `tokens.css`, and never restyles a control family.
 */

interface Finding {
  readonly line: number;
  readonly rule: number;
  readonly text: string;
}

interface Decl {
  readonly selector: string;
  readonly prop: string;
  readonly value: string;
  readonly line: number;
}

const NAMED_COLOURS = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet ' +
  'brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan ' +
  'darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta ' +
  'darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue ' +
  'darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey ' +
  'dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray ' +
  'green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush ' +
  'lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray ' +
  'lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon ' +
  'mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
  'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin ' +
  'navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen ' +
  'paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple ' +
  'rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna ' +
  'silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle ' +
  'tomato turquoise violet wheat white whitesmoke yellow yellowgreen'
).split(' ');

const NAMED_COLOUR = new RegExp(`(?<![\\w-])(?:${NAMED_COLOURS.join('|')})(?![\\w-])`, 'i');
const COLOUR_FN = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/i;
const HEX = /#[0-9a-f]{3,8}(?![\w-])/i;
const UNIT = /(?<![\w.#-])-?(\d*\.?\d+)(px|rem|em|ms|s)(?![\w-])/gi;
const VAR = /var\(\s*(--[\w-]+)/g;
const WEIGHT = /^(?:var\(\s*--font-weight-(?:normal|medium|bold)\s*\)|inherit)$/;

const FAMILY_SELECTOR =
  /\.(?:btn|option|switch|stepper|link-button)(?![a-z])|(?:^|[\s>+~,(])button(?![\w-])/;
const FAMILY_OWNED =
  /^(?:min-block-size|min-inline-size|padding(?:-[\w-]+)?|border(?:-[\w-]+)?|font|font-size|font-weight|background(?:-[\w-]+)?|color)$/;

/** Replace comments with blanks of the same line structure. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
}

/** Flatten one style block into declarations with their nearest non-at-rule selector. */
function parseDeclarations(css: string, firstLine = 1): Decl[] {
  const text = stripComments(css);
  const out: Decl[] = [];
  const stack: string[] = [];
  let pending = '';
  let pendingLine = firstLine;
  let line = firstLine;
  let parens = 0;
  let quote = '';

  const startPending = () => {
    if (pending.trim() === '') pendingLine = line;
  };
  const selector = () => [...stack].reverse().find((s) => !s.startsWith('@')) ?? '';
  const flush = () => {
    const colon = pending.indexOf(':');
    if (colon > 0 && stack.length > 0) {
      out.push({
        selector: selector(),
        prop: pending.slice(0, colon).trim().toLowerCase(),
        value: pending.slice(colon + 1).trim(),
        line: pendingLine
      });
    }
    pending = '';
  };

  for (const ch of text) {
    if (ch === '\n') line++;
    if (quote) {
      pending += ch;
      if (ch === quote) quote = '';
      continue;
    }
    if (ch === '"' || ch === "'") {
      startPending();
      quote = ch;
      pending += ch;
      continue;
    }
    if (ch === '(') parens++;
    if (ch === ')') parens--;
    if (ch === '{' && parens === 0) {
      stack.push(pending.trim().replace(/\s+/g, ' '));
      pending = '';
    } else if (ch === '}' && parens === 0) {
      flush();
      stack.pop();
    } else if (ch === ';' && parens === 0) {
      flush();
    } else {
      startPending();
      pending += ch;
    }
  }
  return out;
}

/** Values without strings and `url()` payloads, which may hold colour-like or unit-like text. */
const valueOf = (v: string): string =>
  v.replace(/"[^"]*"|'[^']*'/g, '""').replace(/url\([^)]*\)/gi, 'url()');

export function lintStyle(
  css: string,
  tokens: ReadonlySet<string>,
  local: ReadonlySet<string> = new Set(),
  firstLine = 1
): Finding[] {
  const findings: Finding[] = [];
  const add = (d: Decl, rule: number) =>
    findings.push({ line: d.line, rule, text: `${d.prop}: ${d.value}`.replace(/\s+/g, ' ') });

  for (const d of parseDeclarations(css, firstLine)) {
    const value = valueOf(d.value);
    const isCustom = d.prop.startsWith('--');
    const colourScope = d.prop !== 'font-family' && d.prop !== 'content';

    if (colourScope && (HEX.test(value) || COLOUR_FN.test(value) || NAMED_COLOUR.test(value))) {
      add(d, 1);
    }
    if ([...value.matchAll(UNIT)].some((m) => parseFloat(m[1]) !== 0)) add(d, 2);
    if ([...value.matchAll(VAR)].some((m) => !tokens.has(m[1]) && !local.has(m[1]))) add(d, 3);
    if (d.prop === 'font-weight' && !WEIGHT.test(value.trim())) add(d, 4);
    if (!isCustom && FAMILY_OWNED.test(d.prop) && FAMILY_SELECTOR.test(d.selector)) add(d, 5);
  }
  return findings;
}

/** Names set in the file: in the style block, `style:--x=` or `style="--x: …"`. */
export function localProperties(source: string): Set<string> {
  const names = new Set<string>();
  for (const m of source.matchAll(/(?<![\w-])(--[\w-]+)\s*:/g)) names.add(m[1]);
  for (const m of source.matchAll(/style:(--[\w-]+)\s*=/g)) names.add(m[1]);
  return names;
}

function svelteFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return svelteFiles(path);
    return name.endsWith('.svelte') ? [path] : [];
  });
}

export function lintSvelte(source: string, tokens: ReadonlySet<string>): Finding[] {
  const local = localProperties(source);
  const findings: Finding[] = [];
  for (const m of source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)) {
    const start = m.index + m[0].indexOf('>') + 1;
    const firstLine = source.slice(0, start).split('\n').length;
    findings.push(...lintStyle(m[1], tokens, local, firstLine));
  }
  return findings;
}

const TOKENS = declaredTokenNames();
const rulesOf = (css: string, local: string[] = []) =>
  lintStyle(css, TOKENS, new Set(local)).map((f) => f.rule);

describe('style lint self-test', () => {
  it('knows the token sheet', () => {
    expect(TOKENS.has('--color-text')).toBe(true);
    expect(TOKENS.has('--space-2')).toBe(true);
  });

  it('rule 1: colour literals', () => {
    expect(rulesOf('.a { color: #fff; }')).toEqual([1]);
    expect(rulesOf('.a { background: rgb(0 0 0 / 0.5); }')).toEqual([1]);
    expect(rulesOf('.a { border-color: hsla(0, 0%, 0%, 1); }')).toEqual([1]);
    expect(rulesOf('.a { fill: red; }')).toEqual([1]);
    expect(
      rulesOf('.a { fill: transparent; stroke: currentColor; color: var(--color-text); }')
    ).toEqual([]);
  });

  it('rule 2: unit literals, including var() fallbacks', () => {
    expect(rulesOf('.a { margin: 4px; }')).toEqual([2]);
    expect(rulesOf('.a { margin: var(--space-2, 0.5rem); }')).toEqual([2]);
    expect(rulesOf('.a { transition: color 120ms; }')).toEqual([2]);
    expect(rulesOf('.a { margin: 0; gap: 0px; }')).toEqual([]);
    expect(
      rulesOf(
        '.a { inline-size: 60ch; flex: 1 1 50%; grid-template-columns: 1fr 2fr; z-index: 2; }'
      )
    ).toEqual([]);
  });

  it('rule 3: undefined custom properties', () => {
    expect(rulesOf('.a { margin: var(--no-such-token); }')).toEqual([3]);
    expect(rulesOf('.a { margin: var(--space-2); }')).toEqual([]);
    expect(rulesOf('.a { margin: var(--ring-base); }', ['--ring-base'])).toEqual([]);
  });

  it('rule 4: font-weight only through the weight tokens', () => {
    expect(rulesOf('.a { font-weight: 600; }')).toEqual([4]);
    expect(rulesOf('.a { font-weight: bold; }')).toEqual([4]);
    expect(rulesOf('.a { font-weight: inherit; }')).toEqual([]);
  });

  it('rule 5: family-owned properties on family selectors', () => {
    expect(rulesOf('.btn { padding: var(--space-2); }')).toEqual([5]);
    expect(rulesOf('.row .option { color: var(--color-text); }')).toEqual([5]);
    expect(rulesOf('.actions button { min-block-size: var(--target-min); }')).toEqual([5]);
    expect(rulesOf('.switch-track { background: var(--color-surface); }')).toEqual([5]);
    expect(rulesOf('.btn { margin: var(--space-2); flex: 1; inline-size: 100%; }')).toEqual([]);
    expect(rulesOf('.options { padding: var(--space-2); }')).toEqual([]);
  });

  it('strips comments and reports the file line', () => {
    const f = lintStyle('/* #fff 4px */\n.a {\n  margin: 4px;\n}', TOKENS, new Set(), 10);
    expect(f).toEqual([{ line: 12, rule: 2, text: 'margin: 4px' }]);
  });
});

describe('component styles take their values from tokens', () => {
  it('has no findings in src/**/*.svelte', () => {
    const lines: string[] = [];
    for (const path of svelteFiles('src')) {
      for (const f of lintSvelte(readFileSync(path, 'utf8'), TOKENS)) {
        lines.push(`${relative('.', path)}:${f.line}  rule ${f.rule}  ${f.text}`);
      }
    }
    expect(lines, `${lines.length} findings:\n${lines.join('\n')}`).toEqual([]);
  });
});
