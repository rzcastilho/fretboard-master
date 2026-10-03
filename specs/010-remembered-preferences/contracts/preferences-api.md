# Contract: Preferences Module API

**Feature**: `010-remembered-preferences` | Layers: `src/lib/prefs` (pure + guarded storage), `src/lib/state/preferences.svelte.ts` (runes orchestration). See [data-model.md](../data-model.md).

## 1. `src/lib/prefs/schema.ts` (pure; no DOM, no Svelte, no storage)

```ts
export interface Preferences {
  readonly tuningId: TuningId;
  readonly fretCount: number;          // integer 12–24
  readonly muted: boolean;
  readonly volume: number;             // 0–100, step 5 (control scale)
  readonly lastTool: ToolId | null;
  readonly labels: { readonly notes: LabelType; readonly triads: TriadsLabelType };
}
export const PREFS_VERSION: 1;
export const MAX_RAW_LENGTH: 16_384;
export const DEFAULT_PREFERENCES: Preferences;              // frozen, FR-018
export function parsePreferences(raw: string | null): Preferences;   // total, never throws
export function serializePreferences(p: Preferences): string;       // v1 record, stable order
```

Laws (property-tested): `parsePreferences(x)` is a valid `Preferences` for every string `x`;
`parsePreferences(serializePreferences(p))` deep-equals `p` for every valid `p`.

## 2. `src/lib/prefs/storage.ts` (the only module that touches `localStorage`)

```ts
export const PREFS_KEY = 'fretboard-master:prefs';
export const PROBE_KEY = 'fretboard-master:probe';
export const KEY_PREFIX = 'fretboard-master:';
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
export function resolveStorage(): StorageLike | null;     // guarded globalThis.localStorage access
export function probeStorage(s: StorageLike | null): boolean;
export function readRaw(s: StorageLike): string | null;   // guarded; null on throw or > MAX_RAW_LENGTH
export function writeRaw(s: StorageLike, value: string): void;  // guarded, fire-and-forget
export function eraseAll(s: StorageLike): void;           // removes every KEY_PREFIX key, guarded
```

Every function catches and swallows storage exceptions; empty catches carry the comment
`// fire-and-forget storage access (FR-010 / EC-9.3)`.

## 3. `src/lib/prefs/session.ts` (plain TS session; no runes)

```ts
export interface PrefsSession {
  readonly available: boolean;
  readonly current: Preferences;
  remember(patch: Partial<Omit<Preferences, 'labels'>> & { labels?: Partial<Preferences['labels']> }): void;
  erase(): void;
}
export function startSession(storage?: StorageLike | null): PrefsSession;
```

- `startSession` probes, then reads once. It never writes the record.
- `remember` merges; writes only if the serialization differs from the last written one.
- `erase` removes stored keys and resets `current` to defaults without writing.

## 4. `src/lib/state/preferences.svelte.ts` (runes singleton)

```ts
export const preferences: {
  readonly lastTool: ToolId | null;
  readonly noticeVisible: boolean;
  start(storage?: StorageLike | null): void;   // called once by hooks.client `init`; idempotent
  toolOpened(id: ToolId): void;                // remembers lastTool
  dismissNotice(): void;
  screenChanged(): void;                       // hides the notice on a real screen change
  erase(): void;                               // FR-017 orchestration, no write
  remember(patch: …): void;                    // used by instrument/playback/notes/triads stores
};
export function resetPreferencesForTests(): void;
```

`start` applies the loaded values through:

| Store | New method | Writes? | Side effects |
|---|---|---|---|
| `instrument` | `restore(config: InstrumentConfig)` | no | sets `active`; `notes/triads.applyInstrument`; no adjusted notice, no playback stop at startup |
| `playback` | `restore({ muted, volume })` | no | no unlock, no `AudioContext` |
| `notes` | `restoreLabelType(t)` | no | also used as the label type of `reset()` / initial view |
| `triads` | `restoreLabelType(t)` | no | same |

Existing user-action methods gain one `preferences.remember(…)` call each:
`instrument.confirm` (when `changed`), `playback.setMuted`, `playback.setVolume`,
`notes.setLabelType`, `triads.setLabelType`. Carry methods (`carryRoot`, `carrySelection`) and
view actions do not call it (FR-019).

## 5. Client hook

```ts
// src/hooks.client.ts
export const init: ClientInit = () => { preferences.start(); };
```

## 6. Import boundaries (ESLint)

- `src/lib/prefs/**` MUST NOT import `svelte`, `svelte/*`, `$app/*`, `$lib/paraglide/*`,
  `$lib/state/*` (value imports), `$lib/shell/*` (value imports). Type-only imports allowed.
- Only `src/lib/state/preferences.svelte.ts` and tests import `$lib/prefs/*`.
