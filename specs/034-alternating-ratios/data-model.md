# Phase 1 Data Model: Alternate Two Ratios

Deltas against slice 033's data model (`specs/033-count-in/data-model.md`). Symbols: *T* = 60 /
BPM, *N* = # of Beats, *k* = effective initial count-in, *r* = effective repeat count-in,
*n1*, *n2* = clicks per beat of Loop 1 and Loop 2.

## 1. Ratio settings (part of `MetronomeSettings`, `src/lib/state/metronome-settings.ts`)

| Field | Type | Default | Validation | Notes |
|---|---|---|---|---|
| `subdivision` | `Subdivision` (1–8) | 3 | `toSubdivision` | Unchanged; **is Loop 1** |
| `ratio` | `boolean` | `true` | `toRatio(v)`: boolean → itself, anything else → `true` | Section switch (FR-001, FR-012) |
| `loop2` | `Subdivision` (1–8) | 6 | `toSubdivision(v) ?? 6` at a parse boundary; setter ignores invalid input | Kept while `ratio` is off (FR-003) |

Derived (pure):

- `effectiveCountIn(s)` — unchanged: `s.countIn ? s.initialCountIn : 0` (*k*).
- `effectiveRepeatCountIn(s)` — new: `s.countIn && s.ratio ? s.repeatCountIn : 0` (*r*, FR-006,
  US3-4).
- `runPlanFor(s)` — new: `{ clicksPerBeat: s.subdivision, initialCountIn: k, alternate: s.ratio
  ? { clicksPerBeat: s.loop2, repeatCountIn: r } : undefined }`.

Mutability: changed only in the `settings` phase (FR-011); `screenChanged()` restores
`DEFAULT_SETTINGS` (Edge Case "leaving the tool"). Nothing is persisted (FR-012).

## 2. Run plan (`RunPlan`, new `src/lib/audio/metronome-cycle.ts`)

| Field | Type | Range | Invalid → |
|---|---|---|---|
| `beats` | integer | 1–16 | 1 |
| `initial` | integer (*k*) | 0–8 | 0 |
| `loops` | `[n1]` or `[n1, n2]` | each 1–8 | each → 1 |
| `repeat` | integer (*r*) | 0–8; forced 0 when `loops.length === 1` | 0 |

Phases of one cycle, in order:

| Section | Phases | Slots per cycle `S` | Clicks per cycle `C` |
|---|---|---|---|
| on | Loop 1 (*N*), Repeat (*r*), Loop 2 (*N*), Repeat (*r*) | `2N + 2r` | `N·n1 + N·n2 + 2r` |
| off | Loop 1 (*N*) | `N` | `N·n1` |

A phase of length 0 (Repeat with *r* = 0) is skipped, so loops switch back to back.

## 3. Slot and click indexing (pure, never accumulated)

- **Slot** `s` (run-global, 0-based): one beat of time. `s < k` → initial count-in click
  `s + 1` of `k`. Otherwise `q = s − k`, `cycle = ⌊q / S⌋`, `w = q mod S`, and `w` falls into
  one phase of §2.
- **Click index** `c` (run-global, 0-based): `c < k` → slot `c`. Otherwise `c' = c − k`,
  `cycle = ⌊c' / C⌋`, `w = c' mod C`; walk the phases by their click counts (`N·n` for a
  loop, *r* for a repeat) to get the phase, its first slot `p0` and the within-phase sub-click
  `j`.
- **Time** of click `c` in a segment that started at slot `s0` with anchor `A`:
  `when = A + (k + cycle·S + p0 + ⌊j / n⌋ − s0) · T + (j mod n) · T / n` — the slot
  difference is an integer evaluated before multiplying by *T*. Count-in clicks have `n = 1`.
- **Inverse** `slotStart(plan, s)` = index of the first click of slot `s`.

Invariants (property-tested, BPM 30–300 × N 1–16 × k, r 0–8 × n1, n2 1–8):

1. `when(slotStart(s + 1)) − when(slotStart(s)) = T` (±1e-9 s) for every `s`, across every
   phase boundary (FR-008, SC-002).
2. Clicks are strictly increasing in time; no two share a time (no overlap).
3. Slot `k + m·S` is Loop 1 beat 1 for every cycle `m` (no drift after 100+ cycles).
4. Section off: the sequence after the prefix is identical to 033's (FR-005, FR-015).

## 4. Slot position (`SlotPosition`, `src/lib/audio/metronome-cycle.ts`)

```text
SlotPosition =
  | { kind: 'count-in', slot, click (1-based), total (k or r), repeat: boolean, next: 1 | 2 }
  | { kind: 'beat',     slot, beat (1…N),     loop: 1 | 2, clicksPerBeat (n1 or n2) }
HaltedAt = SlotPosition | { kind: 'none' }
```

Produced by `slotAt(plan, s)`; carried by `onBeat(beat, at)`, `onCountIn(click, at)` and
`halt()`.

## 5. Click kind (per click)

| Phase | Sub-click | Kind |
|---|---|---|
| initial or repeat count-in | — | `accent` |
| loop, `j mod n = 0`, beat 1 | — | `accent` |
| loop, `j mod n = 0`, beat 2…N | — | `normal` |
| loop, `j mod n ≠ 0` | — | `sub` |

Test-build log `click` entry: `slot` (run-global), `beat` (within loop, 0 for count-in),
`countIn` (1-based within its count-in, else null), **`phase: 'initial' | 'repeat' | 'loop1' |
'loop2'`** (new), `kind`, `accent`, `when`, … (other fields unchanged).

## 6. Cycle position in the store (`src/lib/state/metronome.svelte.ts`)

| State | Type | Meaning |
|---|---|---|
| `phase` | `'settings' \| 'starting' \| 'running' \| 'paused'` | Unchanged |
| `position` | `SlotPosition \| null` | Last slot that sounded; `null` before the first click |
| `initialTotal` | number | *k* of the current run (for `COUNT IN –/k` before click 1) |

Replaces 033's `stage`, `countInClick`, `countInTotal`, `beat`.

State transitions:

| From | Event | To | Effect |
|---|---|---|---|
| settings | toggle (Start) | starting | `position = null`; segment `startSlot: 0`; start announcement |
| starting/running | `onBeat`/`onCountIn(…, at)` | running | `position = at` |
| running | toggle (Pause) | paused | `position = halt()` if not `none`; pause announcement |
| paused | toggle (Resume) | starting | segment `startSlot: (position?.slot ?? −1) + 1`; "Resumed" |
| any but settings | reset | settings | `position = null`; settings unchanged |
| any | screenChanged | settings | defaults restored |

## 7. Display model (pure, `src/lib/state/metronome-view.ts`)

| Position | Status text | Dots |
|---|---|---|
| `null`, *k* > 0 | `COUNT IN –/k` | single dot, idle |
| `null`, *k* = 0 | `BEAT –/N · SUB n1` | *N* dots, all upcoming |
| count-in (initial or repeat) | `COUNT IN click/total` | single pulsing dot, lit |
| beat | `BEAT beat/N · SUB clicksPerBeat` | `beatDots(N, beat)` — beat 1 lit, rest upcoming at a loop start |

`statusParams(beat, beats, sub, countIn)` is unchanged in shape; the store now passes the
playing loop's `sub` and the count-in total (*k* or *r*).

## 8. Announcements (polite live region)

| Moment | Section off (033, unchanged) | Section on (new) |
|---|---|---|
| Start, *k* = 0 | `metronome_announce_started` | `metronome_announce_started_ratio` |
| Start, *k* > 0 | `metronome_announce_started_count_in` | `metronome_announce_started_ratio_count_in` |
| Pause in a loop | `metronome_announce_paused` | `metronome_announce_paused_loop` (names the playing loop) |
| Pause in a count-in | `metronome_announce_paused_count_in` (`count` = *k*) | same key, `count` = *k* or *r* |
| Pause before click 1 | `metronome_announce_paused_count_in_none` | same |
| Resume / Reset | unchanged | unchanged |

Loop switches and individual clicks are never announced.
