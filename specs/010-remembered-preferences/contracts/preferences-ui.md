# Contract: Preferences UI

**Feature**: `010-remembered-preferences`. All strings are catalog messages in `messages/en.json`
(FR-020); all visual values come from existing tokens in `src/lib/styles/tokens.css`.

## New catalog messages

| Key | English |
|---|---|
| `prefs_not_remembered` | Preferences won't be remembered on this device. |
| `home_continue` | Continue |
| `card_label_continue` | Continue: {name}. {question} |
| `about_erase` | Erase my preferences |
| `about_erase_question` | Erase all preferences on this device? |
| `about_erase_confirm` | Erase |
| `about_erase_cancel` | Cancel |

## 1. Not-remembered notice — `src/lib/shell/PrefsNotice.svelte`

- Rendered in `src/routes/+layout.svelte` before the page content; shows iff
  `preferences.noticeVisible`.
- Uses existing `Notice` (`role="status"`, `aria-live="polite"`, Dismiss button, one line).
- Appears on the first screen opened when the probe fails; never when storage works; never twice
  per session; gone after Dismiss or the first real screen change. Not shown after Erase or a
  failed write.

## 2. "Continue" mark — `ToolCard.svelte` (`continued` prop), `HomeScreen.svelte`

- Exactly one card (the last tool) or none shows a visible text badge "Continue".
- Accessible name of that card: `card_label_continue`; others keep `card_label`.
- Cards keep `TOOLS` order; badge uses text + border, not color alone; wraps at 320 px / 200 % zoom.

## 3. Erase — `src/lib/shell/ErasePreferences.svelte` on `/about`

| State | Visible | Focus |
|---|---|---|
| idle | button **Erase my preferences** | unchanged |
| confirming | text "Erase all preferences on this device?" + **Erase** + **Cancel**, inline, same place | **Cancel** |
| after Cancel / Escape | back to idle | **Erase my preferences** |
| after Erase | navigates to `/` | home `h1` (via layout `afterNavigate`) |

- No `<dialog>`, no overlay, no focus trap; Tab order: question text is not focusable, then
  Erase, Cancel (Cancel gets initial focus as the safe choice).
- Buttons ≥ `--target-min` (44 px); errors never shown (erase on unavailable storage still
  restores defaults and goes home).
- Erase stops any playing note immediately.

## 4. Non-functional

- Zero axe violations on Home (with Continue), About (idle + confirming), and any screen with the
  notice, on phone (360 px) and desktop profiles.
- No network request is triggered by any of these interactions (SC-007).
