# Contract: Share UI (components, messages, title)

User-facing interface of the slice. Rationale in [research.md](../research.md) R-10, R-11.

## 1. Components

| Component | Where | Contract |
|---|---|---|
| `src/lib/shell/ShareButton.svelte` | `ToolLayout` header, right after `AppNav` (all three tools; not on Home/About) | `<button type="button">` with visible text `share_button`; accessible name = text; `aria-busy="true"` while `share.busy`; min 44×44 CSS px via `--target-min`; registers itself with `share.registerOpener`. Activation: `share.share(tool, shareTitle(currentSnapshot(tool)))`. |
| Confirmation (existing `Notice.svelte`) | `ToolLayout`, directly under `<header>` | Rendered when `share.notice !== null`, wrapped in `{#key share.notice.id}`; message `share_copied`; `ondismiss` → `share.dismissNotice()`; role=status, aria-live=polite (existing). Auto-hide 4 s. |
| `src/lib/shell/ShareFallback.svelte` | `ToolLayout`, directly under `<header>` (same slot; mutually exclusive with the notice) | `<section aria-labelledby>`; `<label for>` text `share_fallback_label` ("Copy this address"); `<input type="text" readonly>` whose value is the href, focused and fully selected on mount; Dismiss button `notice_dismiss`; Escape inside the section closes; closes on view/tool change; on close focus → Share button. Notice tokens only; no error red. |

Layout: the slot sits between header and `<main>` and never covers the fretboard (C-VII); the
input is `inline-size: 100%` with `min-inline-size: 0` so 320 px and 200 % zoom don't overflow
(only the fretboard scrolls horizontally).

## 2. Messages (en / es / pt-BR — FR-017)

| Key | en | es | pt-BR |
|---|---|---|---|
| `share_button` | Share | Compartir | Compartilhar |
| `share_copied` | Link copied | Enlace copiado | Link copiado |
| `share_fallback_label` | Copy this address | Copia esta dirección | Copie este endereço |
| `share_fallback_region` | Share link | Enlace para compartir | Link para compartilhar |
| `share_title_caged` | {key} {quality} — CAGED | {key} {quality} — CAGED | {key} {quality} — CAGED |
| `share_title_caged_shape` | {key} {quality} — CAGED, {shape} shape | {key} {quality} — CAGED, forma de {shape} | {key} {quality} — CAGED, forma de {shape} |
| `share_title_triads` | {root} {quality} — Triads, {inversion} | {root} {quality} — Tríadas, {inversion} | {root} {quality} — Tríades, {inversion} |
| `share_title_inversion_root` | root position | posición fundamental | posição fundamental |
| `share_title_inversion_first` | 1st inversion | 1.ª inversión | 1ª inversão |
| `share_title_inversion_second` | 2nd inversion | 2.ª inversión | 2ª inversão |
| `share_title_notes` | {notes} — Notes | {notes} — Notas | {notes} — Notas |
| `share_title_notes_empty` | Notes | Notas | Notas |

Quality words come from the existing lower-case `triads_quality_*` keys. Spanish/Portuguese
wording follows the existing glossary in `messages/es.json` / `messages/pt-BR.json`; the
implementer aligns with existing terms (e.g. "Tríades" as used by `tool_triads_name`) and the
pre-launch native-speaker review covers final wording.

## 3. Share title rules (`shareTitle(snapshot): string`)

| Tool | Pieces | Template |
|---|---|---|
| CAGED | key = `noteLabel(cagedRootSpelling(view))`; quality = `triads_quality_<q>`; shape = `view.focus.letter` | focus null → `share_title_caged`, else `share_title_caged_shape` |
| Triads | root = `noteLabel(effectiveRootSpelling(rootPc, override, quality))`; quality = `triads_quality_<q>`; inversion = `share_title_inversion_<inv>` | `share_title_triads` |
| Notes | notes = `selection.map(pc => noteLabel(defaultSpelling(pc))).join(', ')` | empty → `share_title_notes_empty`, else `share_title_notes` |

Examples (en, letters, default accidentals): "A minor — CAGED, E shape", "A minor — CAGED",
"C major — Triads, root position", "C, E, G — Notes", "Notes".

Uses the sharer's language, notation and accidental policy; the title is not part of the link.

## 4. Accessibility

- Keyboard: Tab reaches Share in app-bar order; Enter/Space activate; in the fallback, focus
  starts in the field, Tab reaches Dismiss, Escape closes; no trap.
- Screen reader: notice announced politely once per copy; fallback field has a programmatic
  label; nothing conveyed by color alone.
- axe: zero violations for tool screens with notice open and with fallback open, in en/es/pt-BR.
