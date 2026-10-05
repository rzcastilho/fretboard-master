/**
 * Missing-text detection (contracts/language-api.md §2). Pure; also imported by `vite.config.ts`
 * to build `__FM_MISSING_TEXT__`, so it takes only relative imports.
 */
export type Catalog = Readonly<Record<string, unknown>>;

export const GAP_WARNING = '[fretboard-master] missing text';

/** Keys in `base` (excluding `$schema`) absent from `catalog` or whose value is '' / not a string-or-array. */
export function findMissingKeys(base: Catalog, catalog: Catalog): string[] {
  const missing: string[] = [];
  for (const key of Object.keys(base)) {
    if (key === '$schema') continue;
    const value = Object.prototype.hasOwnProperty.call(catalog, key) ? catalog[key] : undefined;
    const present = Array.isArray(value) || (typeof value === 'string' && value !== '');
    if (!present) missing.push(key);
  }
  return missing;
}

/** Returns the subset of `keys` not yet in `seen` for `locale`, adding them to `seen`. */
export function takeUnreported(
  seen: Set<string>,
  locale: string,
  keys: readonly string[]
): string[] {
  const fresh: string[] = [];
  for (const key of keys) {
    const id = `${locale}:${key}`;
    if (seen.has(id)) continue;
    seen.add(id);
    fresh.push(key);
  }
  return fresh;
}
