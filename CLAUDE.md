# Fretboard Master — agent guidance

The constitution (`.specify/memory/constitution.md`) takes precedence over this file.

## Verification during implementation

The merge gate runs in CI. Locally, keep runs targeted (constitution "Verification tiers"):

| When                         | Command                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------- |
| Per task / checkpoint (unit) | `pnpm vitest run <touched test paths>`                                              |
| Per task / checkpoint (e2e)  | `pnpm build:test` once, then `pnpm test:e2e:fast <spec files added or edited>`      |
| New or changed screenshot    | `pnpm playwright test <spec> -g "<test name>" --project=desktop --update-snapshots` |
| End of slice, once           | `pnpm verify`                                                                       |

- `test:e2e:fast` runs the `desktop` project only, on installed Google Chrome (`pw.local.config.ts`); bundled Chromium does not launch on this macOS.
- Rebuild (`pnpm build:test`) only after changing `src/`; e2e reuses a running `serve-build` server locally.
- Do NOT run `pnpm test:e2e` (full desktop, Firefox, WebKit, no-JS matrix) or `pnpm lhci` locally, except to reproduce a CI failure.
- Unit tests run in the `node` environment by default. A test file that renders a component or touches `document`, `window` or `localStorage` MUST start with `// @vitest-environment jsdom` (otherwise it fails with `document is not defined`). Pure logic tests need no docblock.
- Local Vitest and Playwright runs use half the cores, since several worktrees share the machine. Override with `VITEST_MAX_WORKERS` / `PW_WORKERS` (`4` or `75%`).
