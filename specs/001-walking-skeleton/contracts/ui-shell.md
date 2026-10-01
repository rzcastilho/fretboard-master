# Contract: UI Shell (accessible structure, navigation, messages)

**Feature**: `001-walking-skeleton` | Requirements: FR-002 – FR-014, FR-017, FR-018, FR-020, FR-021

This is the user-facing interface contract. Playwright tests locate elements **only** by the
roles/names below (`getByRole`, `getByText`), so this file is also the selector contract for
`e2e/`. Later slices extend it; they must not rename existing roles or names without updating it.

## Global

- `<html lang="en">`; viewport `width=device-width, initial-scale=1, viewport-fit=cover`.
- Exactly one `h1` per screen; it has `tabindex="-1"` and receives focus after every in-app
  navigation (not on initial load).
- No element with role `progressbar`, no spinner, no modal dialog (`role="dialog"`) anywhere.
- No horizontal page scroll at 320–2560 px or at 200 % text size.

## Home (`/`)

| Region | Role / element | Accessible name | Content |
|---|---|---|---|
| Top zone | `banner` (`<header>`) | — | Product name text "Fretboard Master" as `h1`; link "About" → `/about` |
| Center zone | `main` | — | Optional notice (below); `list` of 2 `listitem` cards |
| Card 1 | `link` → `/notes` | "Fretboard Notes — Where is every note?" (name + question) | Visible: name, question |
| Card 2 | `link` → `/triads` | "Triads — What is a chord made of?" | Visible: name, question |
| Bottom zone | `<div>` (no landmark role, no name) | — | Empty |

- Cards: equal size (same grid track), ≥ 44×44 CSS px, text wraps, no ellipsis, one tab stop each.
- Title: "Fretboard Master".

## Notice (home-with-notice, from unknown address)

| Element | Role | Name / text |
|---|---|---|
| Container | `status` (`aria-live="polite"`) | Text "We could not find that page" |
| Dismiss | `button` | "Dismiss" |

- Placed in `main` above the cards; neutral notice tokens (never error red); ≤ 2 lines; no timer.
- Dismiss removes it, focus moves to `main`'s `h1`; no history entry.

## Tool screens (`/notes`, `/triads`)

| Zone | Element | Accessible name (catalog) | Placeholder text (catalog) |
|---|---|---|---|
| A | `<header>` → `banner`, containing `navigation` | "Application bar"; nav named "Tools" | Nav links (below) |
| B | `region` (`<section aria-labelledby>`) | "Main controls" | "Controls will appear here." |
| C | `region` | "Fretboard" | "The fretboard will appear here." |
| D | `region` | "Context panel" | "Details will appear here." |
| E | `region` | "Actions" | "Actions will appear here." |

- `h1` = tool name; title "<Tool name> — Fretboard Master". The `h1` sits in `main`, before zone B.
- C is the largest zone. Wide (≥ 1024 px): D beside C. Narrow/medium: order A, B, C, E, D.

### Persistent navigation (tools and About)

`navigation` named "Tools", a `list` with, in order:

| Link text | `href` | Current marker |
|---|---|---|
| Home | `/` | — |
| Fretboard Notes | `/notes` | `aria-current="page"` on `/notes` |
| Triads | `/triads` | `aria-current="page"` on `/triads` |
| About | `/about` | `aria-current="page"` on `/about` |

- Current link: `aria-current="page"`, `data-sveltekit-replacestate`, plus a non-color indicator
  (underline bar + bold weight from tokens).

### Failure view (replaces zones B–E only)

| Element | Role | Name / text |
|---|---|---|
| Container | `region` named "Tool error" containing `alert`-free text | "Something went wrong in this view" |
| Reset tool | `button` | "Reset tool" |
| Go to home | `link` → `/` | "Go to home" |

- Not styled with error red (neutral notice tokens). Zone A navigation remains present and operable.
- Reset tool: re-renders zones B–E in place, no reload, no history entry.

### Failure outside a tool (home, About, shell)

`main` shows "Something went wrong in this view" and a `link` "Go to home" (`href="/"`, no
`data-sveltekit-reload`). Activating it resets the shell boundary (when present) and navigates
client-side with `goto('/')`, so it works offline after load; only if `goto` rejects does it fall
back to a full load of `/`. Without JS the plain link performs a normal navigation.

## About (`/about`)

- Persistent navigation (above). `h1` "About Fretboard Master". Paragraph with the description.
  Paragraph "Version X.Y.Z" (X.Y.Z = `package.json` version).
- Title: "About — Fretboard Master".

## Message catalog

`messages/en.json` keys (Paraglide). All user-facing text, including accessible names and titles,
comes from here (FR-017).

| Key | English |
|---|---|
| `app_name` | Fretboard Master |
| `title_screen` | {screen} — Fretboard Master |
| `nav_label` | Tools |
| `nav_home` | Home |
| `nav_about` | About |
| `tool_notes_name` | Fretboard Notes |
| `tool_notes_question` | Where is every note? |
| `tool_triads_name` | Triads |
| `tool_triads_question` | What is a chord made of? |
| `card_label` | {name} — {question} |
| `zone_app_bar` | Application bar |
| `zone_main_controls` | Main controls |
| `zone_fretboard` | Fretboard |
| `zone_context_panel` | Context panel |
| `zone_actions` | Actions |
| `placeholder_main_controls` | Controls will appear here. |
| `placeholder_fretboard` | The fretboard will appear here. |
| `placeholder_context_panel` | Details will appear here. |
| `placeholder_actions` | Actions will appear here. |
| `notice_not_found` | We could not find that page |
| `notice_dismiss` | Dismiss |
| `failure_message` | Something went wrong in this view |
| `failure_region` | Tool error |
| `failure_reset_tool` | Reset tool |
| `failure_go_home` | Go to home |
| `about_heading` | About Fretboard Master |
| `about_description` | Fretboard Master is a set of interactive fretboard study tools for guitarists. Everything runs on your device; there is no sign-up. |
| `about_version` | Version {version} |
