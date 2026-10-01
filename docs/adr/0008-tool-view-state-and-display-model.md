# ADR 0008: Tool view state and display model

- **Status**: Accepted
- **Source**: research R-01, R-02 (spec 004-fretboard-notes-tool)

## Context

The Notes tool is the first real tool. It needs view state (selected notes, filters, region,
open position card) that survives in-app navigation and resets on reload, and a derived display
model for the shared fretboard. Constitution Principle III keeps view state outside tool
components; Principle X forbids speculative abstractions.

## Decision

- **View state** is a pure, framework-free module `src/lib/state/notes-view.ts`: types, initial
  state, and total transition functions. No-ops return the same object (`Object.is`). A thin
  runes singleton store `src/lib/state/notes.svelte.ts` holds one `NotesViewState` in `$state`,
  exposes getters and actions, and calls `playback.stop('view')` on every real state change.
  Following `playback.svelte.ts`, it has a `reset…ForTests` helper.
- **Display model** is a pure `buildNotesModel(state, instrument)` in
  `src/lib/state/notes-model.ts`. It applies the five-step emphasis precedence over all
  positions and derives the notice, Listen steps, card info, and text description. The store
  exposes it as a `$derived`.
- **No generic tool store.** Each tool owns its own state module until a second tool shows a
  real shared shape (Principle X).
- Import boundaries are enforced in `eslint.config.js`: `tools/**` may not import `theory/*` or
  `audio/engine`; `notes-view.ts` may not import `svelte`, `paraglide`, or DOM globals.

## Consequences

- Transitions are unit-testable test-first without Svelte, and reusable by a future share-link
  codec.
- State survives navigation (module singleton) and resets on reload.
- Tools never compute theory; they consume the model.
- A second tool may duplicate a little store boilerplate until a shared pattern is justified.

## Alternatives considered

- Component-local `$state`: violates Principle III, loses state on navigation.
- Generic tool-state store: speculative; no second consumer yet.
- `$effect` watching state to stop playback: indirect, fires on mount, harder to test.
- Computing the model inside components: mixes theory with UI and is hard to test.
