# Contract: `metronome.timerLink` in the stored preferences record (041)

Extends [039 preferences-record](../../039-practice-timer/contracts/preferences-record.md). Format
version unchanged (`"version":1`).

| Stored | Parsed `timerLink` | Other fields |
|---|---|---|
| no `metronome` key | `false` | defaults |
| `"metronome":{"timer":5}` | `false` | `timer: 5` |
| `"metronome":{"timer":5,"timerLink":true}` | `true` | `timer: 5` |
| `"metronome":{"timerLink":true}` | `true` | `timer: 2` |
| `"metronome":{"mode":"speed","timerLink":"yes"}` | `false` | `mode: "speed"` kept |
| `"metronome":"x"` | `false` | defaults |

Serialization: key order inside `metronome` is `ratios`, `plain`, `speed`, `mode`, `timer`,
`timerLink`; `timerLink` is written only when `true`. A record with only `timerLink: false` and all
other fields default serializes with no `metronome` key (byte-identical to 039).

New compatibility fixtures in `tests/unit/prefs/fixtures/` (added, never replacing existing ones):
`metronome-timer-link.txt` (`{"timer":5,"timerLink":true}`), `metronome-timer-link-only.txt`
(`{"timerLink":true}`), `metronome-timer-link-invalid.txt` (`{"mode":"speed","timerLink":"yes"}`).
