# PR description draft: 001-walking-skeleton

Paste into the pull request body. Reviewer approval is requested for the item below
(plan.md → Complexity Tracking; Governance).

## Constitution deviation needing reviewer approval: self-hosted font deferred (R-12)

- **Constitution stack table**: "Fonts: self-hosted".
- **This slice**: ships a system font stack behind the token `--font-family-ui`.
- **Why deferred**: no accidentals or numerals are displayed yet. A font file adds about 20–40 KB
  and a late request that buys nothing now, and it could interact with deploy skew (R-12). The
  glyph coverage for ♯ ♭ 𝄪 𝄫 also cannot be verified until note names render.
- **Plan**: the self-hosted font lands with the first slice that renders note names
  (001-mvp/002). Only the token value changes.
- **Rejected alternative**: shipping the font now (cost without benefit).
- **Ask**: please approve this deviation or request the font in this slice.
