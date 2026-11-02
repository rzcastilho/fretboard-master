# Quickstart: validating the timer link (041)

Prerequisites: `mise install`, `pnpm install`. Contracts: [timer-link-api](contracts/timer-link-api.md),
[preferences-record](contracts/preferences-record.md), [timer-card-ui](contracts/timer-card-ui.md).
Behaviour table: [data-model.md §3](data-model.md).

## 1. Unit (per task)

```sh
pnpm vitest run tests/unit/metronome/timer-link.test.ts tests/unit/metronome/timer-store.test.ts \
  tests/unit/metronome/store.test.ts tests/unit/metronome/timer-card.test.ts \
  tests/unit/prefs/schema.test.ts tests/unit/erase-preferences.test.ts
```

Expected: all pass. `timer-link.test.ts` covers, with fake scheduler clock/frames and a fake timer
clock:
- off (default): start, pause, reset, zero leave the other store untouched (US2, SC-004);
- on, count-in 4: timer reads full during the count-in and starts on the first beat (US1-1/2, SC-002);
- on, no count-in: starts with the first click (US1-4);
- zero halts the metronome, timer stays `finished`, only "Timer finished" announced (US1-3, FR-006);
- Reset mid-run / during count-in, tab switch, `screenChanged`, `restore`, Speed Training end →
  timer stopped at full (US3-1/2/6, SC-005);
- metronome pause/resume holds and releases; hand pause is left alone; pause in count-in keeps the
  pending start (US3-3/5, FR-015);
- timer play with metronome stopped does not start it; play or preset during count-in cancels the
  pending start (US3-4, FR-008);
- switch toggles mid-run (FR-016).

## 2. E2E (per task)

```sh
pnpm build:test
pnpm test:e2e:fast e2e/metronome-timer-link.spec.ts e2e/metronome-timer.spec.ts
```

Expected: the new spec passes (US1–US3, reload keeps the switch on with nothing running, Erase
preferences turns it off, axe clean, 320 px and 200 % zoom without horizontal scroll); the 039 spec
passes unchanged (independence when off).

## 3. Manual smoke (`pnpm dev`, `/metronome`)

1. Timer card → turn on "Start and stop with metronome"; pick `1m`.
2. Count-in on, initial 4. Press Start: `01:00` holds through four count-in clicks, then counts.
3. Wait for `00:00`: the click stops, the readout flashes, the chime plays once.
4. Start again, press Reset at ~`00:40`: timer shows `01:00`, stopped.
5. Reload: switch still on, nothing running. Erase preferences: switch off.

## 4. End of slice

```sh
pnpm verify
```

Screenshot baselines for the Timer card change; regenerate through
`.github/workflows/update-snapshots.yml` (not locally).
