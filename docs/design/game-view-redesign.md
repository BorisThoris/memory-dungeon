# Game View — Redesign ("The Margin")

Source: Claude Design project `3262802e-fc8f-4fb5-9f30-6d09d0d57505`, file
`Game View - Redesign.dc.html` (design system `_ds/classical-…`: Cormorant Garamond headings,
Lora body, gold accent ramp `#e1ad66` / `#facb8d` on ink `#131111`, paper ramp `#f8f4f4` /
`#d7d3d3` / `#bab6b6`). Imported 2026-09-19.

The design's own summary: *"The Margin — chrome becomes type and hairlines. The chain is a
ladder in the left margin; the run line is a caption under the board."* It draws two screens
(1440×900 desktop, 390×844 phone) in five states: mid-run, match floater, memorize, floor
clear, pause.

## Where it landed

| Design element | Repo |
| --- | --- |
| Palette and type tokens (`--margin-*`) | `src/renderer/components/GameScreen.module.css` (`.shell`) |
| Fonts | `src/renderer/styles/global.css` (`@fontsource/cormorant-garamond`, `@fontsource/lora`) |
| Running head, chain ladder, caption, tool row | `src/renderer/components/RunShell.tsx` + `.module.css` |
| Caption kickers, study-period line | `src/renderer/copy/runDialogCopy.ts` (`RUN_SHELL_LINE_COPY`) |
| Board inset past the ladder (desktop) | `GameScreen.module.css` (`--margin-stage-inline-start/end`) |
| Scene backdrop (dungeon ring, sunk and faded) | `GameScreen.tsx` (`UI_ART.gameplayScene`) + `.stageBackdrop` |
| Match / mismatch floater as display type | `GameScreen.module.css` (`.matchScoreFloater`, `.boardFloater*`) |
| Floor-clear colophon with numeral watermark | `src/renderer/components/FloorClearBeat.tsx` + `.module.css` |
| Pause dialog as a page (ruled table, outlined actions) | `OverlayModal surface="margin"` (`OverlayModal.tsx` / `.module.css`), `GameScreen.tsx` pause `dl` |

## What the design left to the repo

- The design's phone shows the ladder under the head with only Clean / Sharp / Fever named;
  the multiplier per rung is desktop-only. Tablets take the phone ladder.
- The design's mid-run kicker reads "Chain 3 · Clean break"; the shell's kicker is the live
  chain standing (`Chain N · Tier`), and the break sentence stays in the line itself, because
  the line is also the mismatch and pickup surface.
- Flash (Practice / Wild runs) keeps its dock tile; the design only drew the nine common tools.
- The pass-and-play seat strip is not in the design; it sits in the head after the mutator,
  in the same small caps.
