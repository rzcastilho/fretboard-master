# Contract: `metronome.sound` in the stored preferences record (042)

Extends [041 preferences-record](../../041-add-and-option-to-initialize/contracts/preferences-record.md).
Format version unchanged (`"version":1`).

| Stored | Parsed `sound` | Other fields |
|---|---|---|
| no `metronome` key | `click` | defaults |
| `"metronome":{"timer":5}` | `click` | `timer: 5` |
| `"metronome":{"sound":"wood"}` | `wood` | defaults |
| `"metronome":{"timer":5,"timerLink":true,"sound":"cowbell"}` | `cowbell` | `timer: 5`, `timerLink: true` |
| `"metronome":{"mode":"speed","sound":"gong"}` | `click` | `mode: "speed"` kept |
| `"metronome":{"mode":"plain","sound":3}` | `click` | `mode: "plain"` kept |
| `"metronome":"x"` | `click` | defaults |

Serialization: key order inside `metronome` is `ratios`, `plain`, `speed`, `mode`, `timer`,
`timerLink`, `sound`; `sound` is written only when not `click`. A record whose metronome fields
are all default serializes with no `metronome` key (byte-identical to 041).

New compatibility fixtures in `tests/unit/prefs/fixtures/` (added, never replacing existing ones):
`metronome-sound.txt` (`{"sound":"wood"}`), `metronome-sound-full.txt`
(`{"timer":5,"timerLink":true,"sound":"cowbell"}`), `metronome-sound-invalid.txt`
(`{"mode":"speed","sound":"gong"}`).

Share links: unchanged; `sound` is never encoded.
Privacy: covered by the existing `metronome` entry of `PRIVACY_CATEGORIES`.
