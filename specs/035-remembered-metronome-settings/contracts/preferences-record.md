# Contract: Preferences record and codec deltas (035)

Extends 010 `contracts/preferences-api.md` §1 (codec) and the 027 privacy mapping. Only the
deltas are listed. Everything not mentioned is unchanged.

## 1. Stored format (`fretboard-master:prefs`, `version: 1`)

New optional top-level key, written last:

```text
metronome?: {
  ratios: {
    bpm: integer 30..300,
    beats: integer 1..16,
    countIn: boolean,
    initialCountIn: integer 0..8,
    repeatCountIn: integer 0..8,
    ratio: boolean,
    loop1: integer 1..8,   // clicks per beat
    loop2: integer 1..8    // clicks per beat
  }
}
```

The writer and reader rules are W1–W4 and R1–R6 in [data-model.md §3](../data-model.md).

## 2. `src/lib/prefs/schema.ts` exports

| Export | Change |
|---|---|
| `Preferences` | adds `readonly metronome: { readonly ratios: MetronomeSettings }` (type-only import) |
| `DEFAULT_PREFERENCES` | adds `metronome: { ratios: METRONOME_RATIOS_DEFAULTS }` (frozen) |
| `METRONOME_RATIOS_DEFAULTS` | **new**: `Readonly<MetronomeSettings>`, equal to `DEFAULT_SETTINGS` |
| `METRONOME_LIMITS` | **new**: `{ bpm: [30,300], beats: [1,16], count: [0,8], loop: [1,8] }` |
| `PRIVACY_CATEGORIES` | adds `metronome: ['metronome']` |
| `parsePreferences(raw)` | returns `metronome` per R1–R4. Still total |
| `serializePreferences(p)` | appends `metronome` per W1–W3 |

Guarantees checked by unit tests:

- C1: `serializePreferences(DEFAULT_PREFERENCES)` is byte-identical to 034's output, with no
  `metronome` key.
- C2: `parsePreferences(serializePreferences(p))` deep-equals `p` for any valid `p`
  (property test with fast-check over the eight fields).
- C3: every existing fixture parses with `metronome.ratios` deep-equal to the defaults, and its
  other fields are unchanged.
- C4: changing any one of the eight stored values to an invalid value (out of range, fraction,
  numeric string, `null`, wrong type) resets only that field (SC-004), and changes no
  non-metronome field.
- C5: `metronome` as `null`, an array, a string, or `{}` with `ratios` set to one of those
  gives all defaults, and parsing does not throw.
- C6: `{ metronome: { ratios: {...valid}, speed: {...anything} } }` gives the `ratios`
  values. Re-serializing drops `speed`.
- C7: parity: `METRONOME_RATIOS_DEFAULTS` deep-equals `DEFAULT_SETTINGS`, and
  `METRONOME_LIMITS` matches `MIN_BPM/MAX_BPM`, `MIN_BEATS/MAX_BEATS`,
  `MIN_COUNT_IN/MAX_COUNT_IN` and `SUBDIVISIONS`.
- C8: every key of `DEFAULT_PREFERENCES`, `metronome` included, appears in
  `PRIVACY_CATEGORIES` (the existing test in `tests/unit/i18n/about-catalog.test.ts`).

## 3. `src/lib/prefs/session.ts`

No API change. `remember({ metronome: { ratios } })` merges by replacing `metronome`, and the
existing unchanged-skip and canonical `lastWritten` rules apply. `erase()` already returns
`DEFAULT_PREFERENCES`, which now includes the metronome defaults.

## 4. Privacy copy (`messages/{en,pt-BR,es}.json` → `about_privacy_stored`)

| Locale | Required change |
|---|---|
| en | List ends "…; hints shown; the shortcuts switch; and metronome settings." "sound, volume and tempo" → "sound, volume, tempo" and "labels and last tool" → "labels, last tool", so the twelve statements stay ≤ 220 words (research R-08) |
| pt-BR | List ends "…; dicas já mostradas; a chave dos atalhos de teclado; e configurações do metrônomo." |
| es | List ends "…; avisos ya mostrados; el interruptor de atajos de teclado; y ajustes del metrónomo." |

The word caps (en 220, pt-BR 280, es 280), the no-jargon rule and the no-third-party rule in
`about-catalog.test.ts` must still pass.
