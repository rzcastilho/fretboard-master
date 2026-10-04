# Fretboard Master — agent guidance

The constitution (`.specify/memory/constitution.md`) takes precedence over this file.

## Verification during implementation

The merge gate runs in CI. Locally, keep runs targeted (constitution "Verification tiers"):

| When                         | Command                                                                                                                   |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Per task / checkpoint (unit) | `pnpm vitest run <touched test paths>`                                                                                    |
| Per task / checkpoint (e2e)  | `pnpm build:test` once, then `pnpm test:e2e:fast <spec files added or edited>`                                            |
| New or changed screenshot    | `pnpm playwright test <spec> -g "<test name>" --project=phone --project=phone-touch --project=desktop --update-snapshots` |
| End of slice, once           | `pnpm verify`                                                                                                             |

- `test:e2e:fast` runs the `desktop` project only, on installed Google Chrome (`pw.local.config.ts`); bundled Chromium does not launch on this macOS.
- Rebuild (`pnpm build:test`) only after changing `src/`; e2e reuses a running `serve-build` server locally.
- Do NOT run `pnpm test:e2e` (full phone, phone-touch, desktop, Firefox, WebKit matrix) or `pnpm lhci` locally, except to reproduce a CI failure.
