# Contract: Stored preferences change (`lastTool`)

**Feature**: `014-caged-shapes` | Key: `localStorage["fretboard-master:prefs"]` | Format `version: 1`

## Change

The `lastTool` allowed set widens from `["notes", "triads"]` to `["notes", "triads", "caged"]`.

- **Reader**: `v.fallback(v.nullable(v.picklist(TOOL_IDS)), null)`. `"caged"` is now kept. Any
  other unknown value still falls back to `null`, independently of the other fields
  (Principle IX).
- **Writer**: unchanged. It writes `lastTool` only when it is non-null.
- **Version**: stays `1`. Widening a picklist is an additive extension (the same rule 013 used
  for optional fields). A pre-014 app reading `"caged"` falls back to `null`, which is its
  existing, safe behaviour.
- **Not stored**: the CAGED key, quality and spelling override are session-only (FR-017).
  CAGED adds no label preference, because labels are fixed in this slice.

## Fixtures (added, never removed)

| Fixture | Content | Expected parse |
|---|---|---|
| `tests/unit/prefs/fixtures/last-tool-caged.txt` (new) | `{"version":1,"lastTool":"caged"}` | `lastTool: 'caged'`, everything else default |
| `tests/unit/prefs/fixtures/wrong-types.txt` (existing, **file unchanged**) | `…"lastTool":"caged"…` | The expectation changes: `lastTool` is now `'caged'`. The other wrong-typed fields still fall back |

## Tests that change expectation

- `tests/unit/prefs/schema.test.ts`: the `it.each(['caged','home'])('lastTool %s → null')` case
  becomes `['home', 'scales']` → null, and a new case checks `'caged'` → `'caged'`.
- `tests/unit/state/preferences-store.test.ts:138`: `toolOpened('caged')` is now remembered.
- `e2e/preferences.spec.ts:249`: the stored `lastTool: 'caged'` record now marks the CAGED card
  "Continue".

Round-trip property: `parse(serialize(p)) === p` for every `p`, with `lastTool` drawn from
`TOOL_IDS ∪ {null}`.
