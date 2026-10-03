# Data Model: Instrument Panel and Preset Tunings

**Feature**: 009-instrument-panel-and-tunings | **Plan**: [plan.md](./plan.md) |
**Research**: [research.md](./research.md)

All entities are in-memory only (FR-018). Nothing is written to storage or to the URL.

---

## 1. `TuningId` and `TuningPreset` — `src/lib/instrument/tunings.ts` (pure)

```ts
type TuningId = 'AF-1' | 'AF-2' | 'AF-3' | 'AF-4' | 'AF-5' | 'AF-6'
              | 'AF-7' | 'AF-8' | 'AF-9' | 'AF-10' | 'AF-11';

interface TuningPreset {
  readonly id: TuningId;
  /** Low → high (TM-2 order), preset's own spelling. Length 6 in this slice. */
  readonly strings: readonly SpelledPitch[];
}
```

| Id | Catalog key (name) | Strings low → high (TM-2) |
|---|---|---|
| AF-1 | `tuning_af1` Standard | E2 A2 D3 G3 B3 E4 |
| AF-2 | `tuning_af2` Half step down | E♭2 A♭2 D♭3 G♭3 B♭3 E♭4 |
| AF-3 | `tuning_af3` Whole step down | D2 G2 C3 F3 A3 D4 |
| AF-4 | `tuning_af4` Drop D | D2 A2 D3 G3 B3 E4 |
| AF-5 | `tuning_af5` Drop C | C2 G2 C3 F3 A3 D4 |
| AF-6 | `tuning_af6` Double Drop D | D2 A2 D3 G3 B3 D4 |
| AF-7 | `tuning_af7` DADGAD | D2 A2 D3 G3 A3 D4 |
| AF-8 | `tuning_af8` Open G | D2 G2 D3 G3 B3 D4 |
| AF-9 | `tuning_af9` Open D | D2 A2 D3 F♯3 A3 D4 |
| AF-10 | `tuning_af10` Open E | E2 B2 E3 G♯3 B3 E4 |
| AF-11 | `tuning_af11` Open A | E2 A2 E3 A3 C♯4 E4 |

**Validation rules**

- Table order is the display order of the preset list.
- Every preset: 6 strings, strictly rising pitch low → high (unit-tested), pitches exactly as
  above (SC-002 table test, 66 rows).
- Spelling is never re-derived: accidental values are stored, not computed (FR-005).

**Constants**: `MIN_FRETS = 12`, `MAX_FRETS = 24`, `DEFAULT_FRETS = 22`,
`DEFAULT_TUNING_ID = 'AF-1'`.

**Derivation**: `presetInstrument(id, fretCount): Instrument` → `{ stringCount: 6, fretCount,
openStrings: reverse(strings) /* string 1 first */, handedness: 'right', orientation:
'highest-top' }`, memoized and frozen; `presetInstrument('AF-1', 22) === STANDARD_GUITAR`.
`isTuningId(x): x is TuningId` allow-list guard.

---

## 2. `InstrumentConfig` — `src/lib/state/instrument-config.ts` (pure)

```ts
interface InstrumentConfig {
  readonly tuningId: TuningId;
  /** Integer, MIN_FRETS ≤ fretCount ≤ MAX_FRETS. */
  readonly fretCount: number;
}
const DEFAULT_CONFIG: InstrumentConfig = { tuningId: 'AF-1', fretCount: 22 };
```

- String count is fixed at 6 (not a field yet — Principle X; added with 7-string slice).
- Handedness/orientation are not fields (out of scope; summary shows "right-handed" as
  fixed catalog text).
- `equalsConfig(a, b)`: same `tuningId` and `fretCount`.
- `instrumentOf(c) = presetInstrument(c.tuningId, c.fretCount)`.
- Derived presentation (computed in components/store getters, not stored):
  - `showsBadge = tuningId !== 'AF-1'` (independent of fret count, FR-011);
  - summary text: Standard → `instrument_summary_standard`; otherwise
    `instrument_summary_preset({ name })`.

---

## 3. `PanelState` — `src/lib/state/instrument-config.ts` (pure)

```ts
type PanelState =
  | { readonly open: false }
  | { readonly open: true; readonly pending: InstrumentConfig };
```

### Transitions (all total; no-ops return the same object)

| Transition | From | Result |
|---|---|---|
| `openPanel(active)` | closed | `{ open: true, pending: active }` (reopen always shows active, FR-009) |
| `openPanel(active)` | open | unchanged |
| `selectTuning(p, id)` | open | `pending.tuningId = id` (unknown id → unchanged) |
| `stepFrets(p, ±1)` | open | `pending.fretCount` clamped to 12..24 |
| `setFrets(p, n)` | open | clamp(n) — used by Home/End (12/24) |
| `restoreDefault(p)` | open | `pending = DEFAULT_CONFIG` (FR-010) |
| `cancel(p)` | open | `{ open: false }`; active untouched (FR-009, SC-005) |
| `confirm(p, active)` | open | `{ panel: { open: false }, next: pending, changed: !equalsConfig(pending, active) }` |
| any edit | closed | unchanged |

State diagram:

```text
          open(active)                 select/step/set/restore
 CLOSED ───────────────▶ OPEN(pending) ◀──────────────┐
   ▲                        │   └─────────────────────┘
   │  cancel (Esc, ✕, backdrop, Back)
   ├────────────────────────┤
   │  confirm → apply iff changed
   └────────────────────────┘
```

---

## 4. Instrument store — `src/lib/state/instrument.svelte.ts` (runes singleton)

| Field | Type | Notes |
|---|---|---|
| `active` | `InstrumentConfig` (`$state.raw`) | starts `DEFAULT_CONFIG` each page load |
| `instrument` | `Instrument` (`$derived`) | `instrumentOf(active)` |
| `panel` | `PanelState` (`$state.raw`) | |
| `previewInstrument` | `Instrument \| null` (`$derived`) | `instrumentOf(panel.pending)` while open |
| `adjustedIn` | `ToolId \| null` (`$state.raw`) | which tool shows the adjustment notice |

**Confirm orchestration** (`confirm(currentScreen)`):

1. `{ panel, next, changed } = confirm(panel, active)`; set `panel`.
2. If `!changed`: stop. (no recalc, no notice, playback untouched)
3. `playback.stop('instrument')` once.
4. `active = next`; `inst = instrumentOf(next)`.
5. `adjNotes = notes.applyInstrument(inst)`; `adjTriads = triads.applyInstrument(inst)`.
6. `adjustedIn = currentScreen === 'notes' && adjNotes ? 'notes'
   : currentScreen === 'triads' && adjTriads ? 'triads' : null`.

`dismissAdjusted()` → `adjustedIn = null`; also cleared on screen change and when the tool's
own notice becomes non-null (research R-05).

---

## 5. Tool view adaptation

### 5.1 Notes — `adaptNotesView(s, prev, next): { view, adjusted }` (`notes-view.ts`, pure)

| Condition | Result | `adjusted` |
|---|---|---|
| `s.region` = `0..prev.fretCount` (whole neck) | region `0..next.fretCount`, card revalidated | only if card closed |
| region end ≤ `next.fretCount` and card valid | `s` (same object) | false |
| region end > `next.fretCount`, start ≤ | `start..next.fretCount` | true |
| both ends > `next.fretCount` | `next.fretCount..next.fretCount` | true |
| card fret > `next.fretCount` | card `null` | true |

Selection, label type, background, hide names and active strings are unchanged (string count
stays 6).

### 5.2 Triads — `revalidate(s, next)` (existing, `triads-view.ts`)

Kept: root, spelling override, quality, inversion, string set, label type, view, compare.
`occurrence` → `min(occurrence, count − 1)`, or 0 when no shape exists (EC-5.1 guidance from
`buildTriadsModel`). `adjusted = result !== s`.

### 5.3 Store methods (both stores)

`applyInstrument(next: Instrument): boolean` — sets the store's instrument, adapts the view,
returns `adjusted`; does **not** stop playback (the orchestrator does) and is a no-op returning
`false` when `next === instrument`. The existing `useInstrument` (used by test hooks) stays
and delegates to it after its own `playback.stop('instrument')`.

---

## 6. View adjustment notice

- Message key `instrument_adjusted`: "We adjusted the view to the new instrument".
- Rendered by `Notice.svelte` (role `status`, `aria-live="polite"`) with Dismiss.
- Visible iff `instrument.adjustedIn === <this tool>` and the tool's own notice is null.

---

## 7. Message catalog additions (`messages/en.json`)

| Key | English |
|---|---|
| `tuning_af1` … `tuning_af11` | Standard, Half step down, Whole step down, Drop D, Drop C, Double Drop D, DADGAD, Open G, Open D, Open E, Open A |
| `instrument_button` | Instrument |
| `instrument_panel_title` | Instrument |
| `instrument_tuning_legend` | Tuning |
| `instrument_preset_label` | {name}: {notes} |
| `instrument_frets_label` | Frets |
| `instrument_frets_decrease` | Fewer frets |
| `instrument_frets_increase` | More frets |
| `instrument_preview_label` | Preview |
| `instrument_confirm` | Confirm |
| `instrument_restore_default` | Restore default |
| `instrument_close` | Close |
| `instrument_badge_label` | Tuning: {name}. Open instrument panel |
| `instrument_summary_standard` | 6 strings · standard tuning · right-handed |
| `instrument_summary_preset` | 6 strings · {name} · right-handed |
| `instrument_adjusted` | We adjusted the view to the new instrument |

"·" separators are part of the catalog string so translations control them (Principle VIII).
