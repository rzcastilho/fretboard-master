# Contract: Metronome and preferences store deltas (035)

Extends 034 `contracts/metronome-store-api.md` and 010 `contracts/preferences-api.md` §4. Only
the deltas are listed.

## 1. `src/lib/state/metronome.svelte.ts`

### New

```ts
/** Apply remembered settings without writing (035). Halts any run and returns to the settings phase. */
restoreSettings(s: MetronomeSettings): void
```

- M-R1: afterwards, `phase === 'settings'`, `position === null`, the scheduler is halted
  (`'leave'` reason) when one was running, and `settings` deep-equals `s`.
- M-R2: it never calls `preferences.remember`.

### Changed

| Member | 034 behaviour | 035 behaviour |
|---|---|---|
| `screenChanged()` | halt, settings phase, **settings ← defaults** | halt, settings phase, **settings kept** |
| `setBpm`, `stepBpm`, `setBeats`, `stepBeats`, `setCountIn`, `setInitialCountIn`, `stepInitialCountIn`, `setRepeatCountIn`, `stepRepeatCountIn`, `setRatio`, `setSubdivision`, `setLoop2` | update `state.settings` | same, and when the settings object changed, call `preferences.remember({ metronome: { ratios: settings } })` |

- M-W1: a mutation that leaves the settings unchanged (a stepper at its limit, an ignored
  invalid value, a call outside the settings phase) does not call `remember`.
- M-W2: `toggle()` (Start / Pause / Resume) and `reset()` never call `remember`.
- M-W3: no call throws when storage is unavailable. `preferences.remember` is a no-op without
  a session, and the session swallows write failures.

### Unchanged

`toggle`, `reset`, the announcements, the keys, the click timing, the view getters and
`resetMetronomeForTests` (it still sets the defaults or overrides directly and never writes).

## 2. `src/lib/state/preferences.svelte.ts`

| Member | Change |
|---|---|
| `start(storage?)` | also calls `metronome.restoreSettings(p.metronome.ratios)` |
| `erase()` | also calls `metronome.restoreSettings(<defaults>)`, using `session.current.metronome.ratios` after `session.erase()`, or `DEFAULT_PREFERENCES.metronome.ratios` when there is no session |

The one-time unavailable notice is unchanged (FR-011).

## 3. Observable UI contract (e2e)

No markup changes. The 031–034 settings view (`data-phase="settings"`, the BPM and beats
digits, the Count In and Subdivision ratio switches, the Initial and Repeat Count In values,
and the Loop 1 and Loop 2 selects) shows the restored values on first render after:

- a reload,
- leaving the route and returning,
- Reset,
- Erase (defaults).

The running view never appears on opening.
