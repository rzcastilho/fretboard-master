# Data Model: Walking Skeleton — Home Screen and Navigation

**Feature**: `001-walking-skeleton` | **Date**: 2026-09-30 | **Plan**: [plan.md](./plan.md)

This slice has no persisted data, no storage, and no theory. Its "data" is static configuration
compiled into the bundle plus short-lived UI state. All entities are TypeScript types in
`src/lib/shell/`; none is serialized, stored, or sent over the network.

## Entities

### Tool

A study screen reachable from home.

| Field | Type | Rules |
|---|---|---|
| `id` | `'notes' \| 'triads'` | Unique. Closed union — CAGED is added by a later slice by extending the union. |
| `path` | `'/notes' \| '/triads'` | Must be one of the known screen paths (FR-022). |
| `name` | message function (`m.tool_notes_name`, `m.tool_triads_name`) | From catalog (FR-017). "Fretboard Notes", "Triads". |
| `question` | message function (`m.tool_notes_question`, `m.tool_triads_question`) | From catalog. "Where is every note?", "What is a chord made of?". |

- **Source**: `src/lib/shell/tools.ts` exports `TOOLS: readonly Tool[]` in display order
  `[notes, triads]` (FR-003 order; also nav order, FR-006).
- **Invariants** (unit-tested): exactly two tools; ids unique; paths unique and in
  `KNOWN_PATHS`; order notes → triads.

### Screen

A navigable destination tracked by browser history.

| Field | Type | Rules |
|---|---|---|
| `id` | `'home' \| 'notes' \| 'triads' \| 'about'` | Unique. |
| `path` | `'/' \| '/notes' \| '/triads' \| '/about'` | `KNOWN_PATHS`. Any other path is *unknown* (FR-010). Trailing slash normalized by hosting/`trailingSlash: 'never'`. |
| `heading` | message function | Exactly one `<h1>` per screen: "Fretboard Master", tool name, "About Fretboard Master" (FR-021). |
| `title` | message function | "Fretboard Master" on home; "<Screen name> — Fretboard Master" elsewhere (FR-021). |

- **Source**: `src/lib/shell/screens.ts` (`SCREENS`, `KNOWN_PATHS`, `screenTitle(id)`).
- **Navigation relationship**: Home → {Notes, Triads, About}; Notes/Triads/About → {Home, Notes,
  Triads, About} via persistent navigation (one action each, SC-003).

### Notice

A short, dismissible, non-blocking message on a screen.

| Field | Type | Rules |
|---|---|---|
| `kind` | `'not-found'` | Only kind in this slice. Closed union. |
| `text` | message function (`m.notice_not_found`) | "We could not find that page". ≤ 2 lines at 320 px and 200 % text zoom (FR-011). |
| `visible` | `boolean` (component `$state`) | Never persisted, never in URL. |

**State transitions**

```text
(unknown path opened) ──► visible ──[Dismiss]──► gone        (no history entry)
                              └────[navigate to any screen]──► gone
(no timer transition exists)
```

- Lives in the catch-all route's `HomeScreen` instance; leaving the route destroys it. Reloading
  `/` after the URL replacement shows home without notice (D-01).

### Tool failure state

The containment state of one tool's zones B–E (owned by `<svelte:boundary>`).

| State | Shows | Transitions |
|---|---|---|
| `ok` | Placeholder zones B–E | render error → `failed` |
| `failed` | "Something went wrong in this view", **Reset tool**, **Go to home** | **Reset tool** → re-render (→ `ok`, or `failed` again if fault recurs); **Go to home** → navigate `/` (tool unmounted) |

- Leaving the tool and returning starts in `ok` (no per-session tool state, D-08).
- A failure in one tool never changes the other tool's state (separate route components).

### Failure record

What is written when a failure is caught. Console only (C-03, FR-012).

| Field | Type | Rules |
|---|---|---|
| `name` | `string` | `error.name` if `error instanceof Error`, else `'UnknownError'`. |
| `message` | `string` | `error.message` if `Error`, else `String(error)` truncated to 500 chars. |
| `tool` | `'notes' \| 'triads' \| null` | `null` for failures outside a tool. |

- Written via `console.error('[fretboard-master] failure', record)`. No storage write, no network
  request, no URL, no user agent, no timestamps beyond what the console adds.
- **Source**: `src/lib/shell/failure.ts` `recordFailure(tool, error): FailureRecord`
  (pure builder + console side effect; builder unit-tested).

### Application version

| Field | Type | Rules |
|---|---|---|
| `version` | `string` matching `^\d+\.\d+\.\d+$` | From `package.json` `version` at build time via `__APP_VERSION__` (C-05, FR-008). Initial value `0.1.0`. |

## Validation rules summary

| Rule | Enforced by |
|---|---|
| Only `KNOWN_PATHS` are screens | SvelteKit routes + catch-all; E2E SC-005 matrix |
| Two tools, fixed order | Unit test on `TOOLS` |
| All user-facing text from catalog | Paraglide messages; lint/test scan for raw text |
| Version is semver from `package.json` | Unit test |
| Failure record has no personal data and never leaves console | Unit test on builder; E2E request listener asserts 0 requests |

## Out of scope (later slices)

Preferences (DM-14), view state (DM-15), share-link format (DM-17), instrument (DM-5), and
measurement events (DM-18) are not modeled here.
