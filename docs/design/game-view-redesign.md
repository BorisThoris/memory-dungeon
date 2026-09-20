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

## The start menu (2026-09-20)

The menu is the book's title page in the same language: the title block (crest, eyebrow,
display title, hairline, italic tagline) on one side and the *contents* on the other — Play as
entry I in gold, then Collection … Settings as a numbered ladder with leader rules and a note
each — with a colophon at the foot stating the profile strip (`Level · Best · Last descent`,
the hub-quality rows `profile_strip` and `return_loop`).

Layout is fluid, not fitted. The previous shell scaled a fixed layout with CSS `zoom`
(`useFitShellZoom`, `hubShellFit`) behind six viewport regimes, which left phones with a
left-aligned half page and short landscapes with an off-centre stack; both hooks are gone. The
spread is a grid that goes to two columns at `≥ 900 px` wide (or `≥ 760 px` when the page is
short) and stacks otherwise; type and spacing use `clamp()` against `vh`/`vw`; the page is
`100 dvh` with safe-area insets and scrolls internally only if it ever must. Measured: no
scrollport overflow and the contents fully in view at 320×568, 375×812, 800×600, 844×390,
900×700 and 1280×720.

| Design element | Repo |
| --- | --- |
| Title page, contents ladder, colophon | `src/renderer/components/MainMenu.tsx` + `.module.css` |
| Same `--margin-*` tokens as the run shell | declared on `.shell` in `MainMenu.module.css` |
| First-run help as a ruled note under the contents | `MainMenu.tsx` (`main-menu-help-center`) |

Fixed alongside, in the run shell's responsive logic: the ladder is now a real box that contains
its rung labels and the read beside the marker (the long-run HUD gate measures every head cell
for a readable box that does not clip); the phone-portrait head leaves the mutator out of the DOM
instead of hiding it; the score's digit cell keeps a minimum width; the pause sheet on phones
keeps the 14 px gutter the safe-area contract asks for; the floor-clear beat's clock starts on
its first painted frame; and the ladder's column of the relit backdrop is set on ink so the left
torch cannot wash out the rung labels.

## The mode page, the settings and every dialog (2026-09-20)

The rest of the shell now speaks the same language, so a player never leaves the book.

**Choose Your Path** is the first chapter page: the chapter title on one side, *the runs* on the
other as a numbered ladder with leader rules — entry I is the recommended run in gold, opened out
with its summary, the first-run beats and its two actions (Start run as a gold outlined word, the
setup sheet beside it); each library mode is one line (numeral, title, group as the note, one
sentence, its poster as a watermark at the line's end) and opens its detail dialog; the last
entry is the shared run, a field on a hairline with *Play it* beside it. A running head carries
Back and Settings on one gold rule; the offline note is the colophon. The layout is the title
page's: a spread that goes to two columns at `≥ 900 px` (or `≥ 760 px` when short), stacks
otherwise, and drops the tagline, beats and descriptions under 560 px of height. The filter
chips and the search remain for a library long enough to need them.

**Settings** (the page and the in-run dialog) is a chapter with a contents ladder in the margin:
the categories numbered I–VI with leaders, the chosen one in gold; the chapter on the right with
its title on a gold rule, its subsections as small capitals underlined in gold, ruled sections,
and each control as a line — the name in display type, the note in the italic voice, the control
at the line's end (a hairline switch that fills gold, a row of words with the chosen one
underlined, a gold thread with its value beside it). Back and Save are outlined words on the foot
rule. The four layouts (`desktop`, `wide-short`, `stacked`, `short-stacked`) and every test id
are unchanged; a stacked shell's chooser is one field in the ladder's type.

**Every dialog** is on the Margin surface by default (`OverlayModal surface` now defaults to
`margin`): the mode detail, the setup sheet (`wide`), the shortcut list, the abandon
confirmation, the unsaved-settings question. Plates and cornices are not drawn there; a `danger`
tone only takes the hairline from gold to paper.

**The primitives** the meta screens are built from were redrawn rather than each screen:
`UiButton` is an outlined word (gold primary, paper secondary, the danger no louder); `Panel` is
a ruled region; `Eyebrow` / `ScreenTitle` are the small capitals and the Cormorant display;
`SectionRail` and the `FittedGrid` pager are small capitals on a rule; `StatTile` is a value in
display type over its name on a hairline; `MetaShell` and `MetaScreen` are the page with a
running head; `MetaFrame` draws no cornice. Collection, Codex, Profile, Inventory and the run's
last page then carry ruled notes — a hairline box with a two-pixel head rule, gold where the
thing is earned, current or unlocked — in place of the plated cards.

| Design element | Repo |
| --- | --- |
| Shared `--margin-*` tokens | `src/renderer/styles/global.css` (`:root`) |
| Chapter page, runs ladder, shared-run entry | `ChooseYourPathScreen.tsx` + `.module.css` |
| Settings ladder, chapter, controls | `SettingsScreen.tsx` / `.module.css`, `SettingsControls.tsx` |
| Dialogs on the Margin surface | `OverlayModal.tsx` / `.module.css` (`surface`, `wide`) |
| Outlined words, ruled regions, rails, tiles | `src/renderer/ui/*.module.css` |
| Meta screens' ruled notes | `CollectionScreen`, `CodexScreen`, `ProfileScreen`, `InventoryScreen`, `GameOverScreen`, `MetaScreen` `.module.css` |
