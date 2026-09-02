> **Status (2026-09):** superseded by the green-field UI rebuild recorded in `docs/UI_RETHINK_PLAN.md`.
> The in-run shell is now one engraved bar, one feedback line and one dock with nothing boxed over the
> board; the itemised gaps below describe the pre-rebuild HUD and are kept for history. The dead
> GameScreen model island named in the follow-up task (board models, floater projection, route-choice
> model, decision signals) has been deleted rather than wired up.

# Current app vs end-product reference - screenshot audit

This document compares Playwright captures of the live Vite renderer against the product stills `docs/ENDPRODUCTIMAGE.png` (gameplay / system breakdown) and `docs/ENDPRODUCTIMAGE2.png` (main menu, settings gameplay tab, mode selection). Use it for art, UI, and systems parity, not pixel-diff automation.

## How the captures were produced

- Command (Unix / Git Bash): `VISUAL_CAPTURE_ROOT=docs/reference-comparison/captures yarn playwright test e2e/visual-screens.standard.spec.ts --workers=1`
- Command (Windows PowerShell): `$env:VISUAL_CAPTURE_ROOT='docs/reference-comparison/captures'; yarn playwright test e2e/visual-screens.standard.spec.ts --workers=1`
- Harness: [`e2e/visualScenarioSteps.ts`](../../e2e/visualScenarioSteps.ts), [`e2e/visualScreenHelpers.ts`](../../e2e/visualScreenHelpers.ts)
- Browser: Chromium (Playwright `Desktop Chrome` device profile)
- Test save defaults: `reduceMotion: true` in the visual save JSON, so motion-gated effects differ from a normal player session
- Web server: Vite on `127.0.0.1:5173` (same as [`playwright.config.ts`](../../playwright.config.ts))
- Screenshot method: `page.screenshot({ fullPage: true })` per scenario

Recent parity work (toolbar illustrated icons, optional board bloom, Game Over scene plate, meta-screen TOCs, graphics quality defaults) can shift captures slightly versus older baselines. Regenerate desktop / mobile sets when diffing against this doc. Open P0/P1 visual queue: [`docs/new_design/TASKS/ULTRA_REFINE_OPEN_QUEUE.md`](../new_design/TASKS/ULTRA_REFINE_OPEN_QUEUE.md).

### Viewports on disk

| Folder | Size | Role |
|--------|------|------|
| [`captures/desktop/landscape/`](captures/desktop/landscape/) | 1440x900 | Primary comparison to wide mockups |
| [`captures/tablet/portrait/`](captures/tablet/portrait/) | 820x1180 | Stacked / mobile-ish layout regression |

> Note: long visual runs can flake. `yarn test:e2e:visual` has previously timed out on `inventory during a run`; `e2e/visual-screens.standard.spec.ts` has also failed mid-suite with `ERR_CONNECTION_REFUSED` to Vite, or on `08-game-over` (hidden-tile wait / `discoverMismatchPair` in the level-1 game-over harness). Retry with `--workers=1`. For desktop-only doc stills, `-g "desktop-landscape"` is a narrower pass.

### Reference stills (source of truth)

| File | Contents |
|------|----------|
| [`../ENDPRODUCTIMAGE.png`](../ENDPRODUCTIMAGE.png) | Gameplay board, HUD breakdown, card states (back, hover, face, matched), sidebar legend, palette notes |
| [`../ENDPRODUCTIMAGE2.png`](../ENDPRODUCTIMAGE2.png) | Triptych: main menu (left), settings Gameplay (top right), Choose Your Path (bottom right) |

### Capture to scenario map

| Capture basename | Scenario | Primary reference |
|------------------|----------|-------------------|
| `00-startup-intro.png` | Startup relic intro | Not shown on ENDPRODUCT stills |
| `01-main-menu.png` | Main menu | ENDPRODUCTIMAGE2 left panel |
| `01a-choose-your-path.png` | Choose Your Path | ENDPRODUCTIMAGE2 bottom right |
| `01b-collection.png` | Collection | Not on ENDPRODUCT stills |
| `01c-inventory-empty.png` | Inventory (no run) | Not on ENDPRODUCT stills |
| `01d-inventory-active.png` | Inventory (in run) | Not on ENDPRODUCT stills |
| `01e-codex.png` | Codex | Not on ENDPRODUCT stills |
| `02-main-menu-howto.png` | Main menu + How To Play | Not on ENDPRODUCT stills |
| `03-settings-page.png` | Settings (Gameplay category) | ENDPRODUCTIMAGE2 top right |
| `04-game-playing.png` | Level 1 playing | ENDPRODUCTIMAGE main board / HUD |
| `05-pause-modal.png` | Pause | Not on ENDPRODUCT stills |
| `06-run-settings-modal.png` | Run settings | Not on ENDPRODUCT stills |
| `07-floor-cleared-modal.png` | Floor cleared | Not on ENDPRODUCT stills |
| `08-game-over.png` | Game over | Not on ENDPRODUCT stills |

---

## 1. Main menu vs ENDPRODUCTIMAGE2 (left panel)

**Captures:** [`captures/desktop/landscape/01-main-menu.png`](captures/desktop/landscape/01-main-menu.png)

### Matched or close

- Dark fantasy menu scene layer plus procedural background
- Vertical primary actions (Play, Collection, Inventory, Settings, Exit) with secondary hint lines
- Secondary content: extra run types grid plus run archive / stats region

### Differences and missing elements

| Area | Reference | Current |
|------|-----------|---------|
| Top strip | Player level badge, display name, two currencies, journal / mail / quick-settings icons | Four meta cards (Build, Best score, Daily streak, Steam); no level ring, no dual currency, no journal / mail / quick-settings cluster |
| Title treatment | Large embossed gold metallic wordmark | Light serif / cream display title plus small crest SVG |
| Play CTA | Red-black gradient, prominent sword / book icon, jewel-like CTA | Primary `UiButton` styling; no matching iconography on the main Play row |
| Menu item labels | Collection, Daily Challenge, Settings, Exit as top-level vertical list | Play opens mode select; Daily is not duplicated top-level; Collection and Settings remain present |
| Bottom widgets | Daily challenge tile, current run tile, social icons | Alternate descents plus profile / progress panel; no social strip |
| Background composition | Strong blue portal focal point, chains, specific staging | Illustrated PNG plus procedural field; composition is not locked to the same focal art |
| Grid overlay | Not part of reference | Faint grid visible in capture over the scene |

---

## 2. Settings (Gameplay) vs ENDPRODUCTIMAGE2 (top right)

**Captures:** [`captures/desktop/landscape/03-settings-page.png`](captures/desktop/landscape/03-settings-page.png)

### Matched or close

- Split shell: left category rail plus right pane
- Live settings map to real `Settings` in code
- Wide viewports use a `settings-shell-panel` surface with optional fit-zoom, while stacked layouts use a full-width shell

### Differences and missing elements

| Area | Reference | Current |
|------|-----------|---------|
| Difficulty | EASY / NORMAL / HARD / NIGHTMARE toggles | Not in live model |
| Timer mode | CLASSIC / COUNTDOWN / RELENTLESS | Not in live model |
| Max lives | Six-heart selector | Not in live model |
| Card theme | Five card-back previews (four themes plus locked) | Not implemented; no theme row |
| Tutorial hints | Dedicated toggle | Only partially covered elsewhere |
| Footer | Reset to defaults | Current uses Back plus Save |

---

## 3. Choose Your Path vs ENDPRODUCTIMAGE2 (bottom right)

**Captures:** [`captures/desktop/landscape/01a-choose-your-path.png`](captures/desktop/landscape/01a-choose-your-path.png)

### Matched or close

- Three columns: Classic, Daily (featured), Endless (locked)
- Copy explains daily UTC rotation
- Countdown footer for daily; endless is honestly disabled

### Differences and missing elements

| Area | Reference | Current |
|------|-----------|---------|
| Card art | Tall illustrated posters inside ornate gold frames | Flat gradient panels, no archway illustrations, lighter filigree |
| Subtitle | "Every run is a new challenge..." style line | Different explanatory paragraph |
| Selection chrome | Strong outer glow on selected mode | Featured badge plus modest purple glow |
| Stats line | Best score / best floor as large display numerals | Tabular numerals plus labels; empty states show `--` |

---

## 4. Gameplay vs ENDPRODUCTIMAGE.png

**Captures:** [`captures/desktop/landscape/04-game-playing.png`](captures/desktop/landscape/04-game-playing.png) plus the local parity set under `test-results/endproduct-parity/`: `main-game-screen.png`, `top-bar-details.png`, `sidebar-menu.png`, `card-face-down.png`, `card-hover.png`, `card-flipped.png`, `card-matched.png`, `interaction-flip.png`, `interaction-match.png`, `interaction-mismatch.png`.

### Matched or close

- Dungeon-style stage backdrop plus run chrome
- Top HUD still keeps Floor, Lives, Shards, Score, Daily, and Score Parasite in one cohesive header
- Left vertical toolbar is functionally aligned with the sidebar intent
- The parity spec now captures the whole gameplay panel and dedicated card-state / interaction crops from the live renderer, not just HUD and board fragments

### Differences and missing elements

| Area | Reference | Current |
|------|-----------|---------|
| HUD segmentation | Distinct gold-trimmed modules, hex-like floor badge, score parasite bar | [`top-bar-details.png`](../../test-results/endproduct-parity/top-bar-details.png) shows a coherent dual-row deck, but the chrome still reads flatter and lighter than the mock modules; the secondary strip competes more with the hero score |
| Daily / parasite proportions | Daily seed and parasite sit as compact peers beside the center score | The data is present, but the Daily and Score Parasite modules are wider / heavier than the reference and push the HUD toward utility-strip density |
| Sidebar composition | Collapsed medallion rail plus expanded labeled flyout | [`sidebar-menu.png`](../../test-results/endproduct-parity/sidebar-menu.png) captures only the collapsed rail: functionally correct, but still more utility-oriented and missing the flyout composition shown in the board art |
| Board framing | Cards on a circular stone dais with strong floor graphic | [`main-game-screen.png`](../../test-results/endproduct-parity/main-game-screen.png) still reads as cards over a grid / vignette more than cards embedded in a raised stone arena; spotlight and torch warmth are softer than the mock |
| Card backs | One shared authored SVG hidden-card back | [`card-face-down.png`](../../test-results/endproduct-parity/card-face-down.png) confirms hidden cards share one back. See [`authored-card-back.svg`](../../src/renderer/assets/textures/cards/authored-card-back.svg) and [`ASSET_SOURCES.md`](../../src/renderer/assets/ASSET_SOURCES.md). |
| Hover | Intense gold bloom with tighter premium edge light | [`card-hover.png`](../../test-results/endproduct-parity/card-hover.png) shows a readable hover state, but the result is a broad gold wash over the card more than a tight ornamental bloom around the rim |
| Card faces | 3D crystal relic, gold serif name, effect line | [`card-flipped.png`](../../test-results/endproduct-parity/card-flipped.png) still resolves to a symbol-centric face with a small numeric badge; the live front lacks the richer title / subtitle / relic illustration hierarchy of the reference |
| Flip interaction | Page-turn / hinge feel with clear motion smear | [`interaction-flip.png`](../../test-results/endproduct-parity/interaction-flip.png) captures the live flip moment, but it still reads closer to a front-face transition than the cinematic page-turn shown in the concept board |
| Matched state | Green glow plus large checkmark overlay | [`card-matched.png`](../../test-results/endproduct-parity/card-matched.png) proves the live matched state is unambiguous, but the success language remains softer than the reference: no large checkmark centerpiece and less celebratory particle density |
| Match interaction | Green burst, particle celebration, floating `+50` | [`interaction-match.png`](../../test-results/endproduct-parity/interaction-match.png) captures the live success halo, but the burst still lacks the stronger score-popup / celebration framing shown in the mock |
| Mismatch | Red pulse plus stress cues | [`interaction-mismatch.png`](../../test-results/endproduct-parity/interaction-mismatch.png) now captures the real resolving mismatch state, but the recoil remains calmer than the mock and still carries tutorial badge chrome |
| Tutorial / pair markers | Not present in the reference panels | The gameplay shell capture is clean, but the state / interaction crops still include tutorial pair badges for deterministic level-1 fixtures. Those need a capture-profile decision: suppress for parity stills or explicitly keep as product truth |
| Typography / palette temperature | Warm gold / ember / walnut balance with ivory type accents | Current gameplay crops still skew cooler teal / charcoal overall. Cinzel / Inter hierarchy is present, but the live palette needs a warmer pass to match the reference board tone |

**Tracking:** gameplay gaps above map to **`PLAY-*`** in [`docs/new_design/TASKS/PLAYING_ENDPRODUCT/README.md`](../new_design/TASKS/PLAYING_ENDPRODUCT/README.md) (thin landing: [`TASKS_PLAYING_ENDPRODUCT.md`](../new_design/TASKS/TASKS_PLAYING_ENDPRODUCT.md)). Card-back / vector and optional raster path: [`PLAYING_ENDPRODUCT/05-cards.md`](../new_design/TASKS/PLAYING_ENDPRODUCT/05-cards.md); tile FX: [`TASKS_CARDS_VFX_PARITY.md`](../new_design/TASKS/TASKS_CARDS_VFX_PARITY.md). Completed `HUD-*` / `SIDE-*` rows live in [`TASKS_ARCHIVE_PARITY.md`](../new_design/TASKS/TASKS_ARCHIVE_PARITY.md).

**Quick captures (`PLAY-010` / `QA-001` gate):** `yarn playwright test e2e/hud-inspect.spec.ts e2e/visual-endproduct-parity.spec.ts --workers=1` writes under `test-results/endproduct-parity/` (gitignored; set `VISUAL_CAPTURE_ROOT` to override). The current stable gameplay-panel basenames are:

| Artifact | Purpose |
|----------|---------|
| `main-game-screen.png` | Full gameplay shell vs the main panel in `ENDPRODUCTIMAGE.png` |
| `top-bar-details.png` | HUD chrome vs the top-bar detail panel |
| `sidebar-menu.png` | Collapsed in-game rail vs the sidebar panel |
| `card-face-down.png` / `card-hover.png` / `card-flipped.png` / `card-matched.png` | Current live card-state grammar |
| `interaction-flip.png` / `interaction-match.png` / `interaction-mismatch.png` | Current live motion / resolve language |
| `hud-1280x720.png` / `hud-1440x900.png` / `hud-1440x900-arcade.png` | Legacy HUD crops still used by HUD parity work |
| `tile-board-1280x720.png` / `tile-board-1440x900.png` / `tile-board-1440x900-arcade.png` | Legacy board crops still used by board / FX parity work |
| `hud-metrics.json`, `hud-fragment.html`, `hud-context-fullpage.png`, `hud-element.png` | Layout diagnostics for review and debugging |

Use those with this section when diffing against marketing stills. These specs target the dev sandbox playing fixture and are the stable local gate when `visual-screens.standard` is flaky.

---

## 5. Screens captured but not in ENDPRODUCT stills

These captures are useful for regression but have no direct panel in `ENDPRODUCTIMAGE.png` / `ENDPRODUCTIMAGE2.png`:

- Startup intro (`00-startup-intro.png`)
- Collection (`01b-collection.png`)
- Inventory empty / active (`01c`, `01d`)
- Codex (`01e-codex.png`)
- How To Play overlay (`02-main-menu-howto.png`)
- Pause (`05-pause-modal.png`)
- Run settings (`06-run-settings-modal.png`)
- Floor cleared (`07-floor-cleared-modal.png`)
- Game over (`08-game-over.png`)

Gap type: reference scope is narrower than the Steam demo surface area; parity is judged against [`docs/new_design/CURRENT_VS_TARGET_GAP_ANALYSIS.md`](../new_design/CURRENT_VS_TARGET_GAP_ANALYSIS.md) and task files, not only these two PNGs.

---

## 6. Regenerating captures

From repo root:

```bash
# Tablet + desktop (recommended; stable in CI-like runs)
cross-env VISUAL_CAPTURE_ROOT=docs/reference-comparison/captures yarn playwright test e2e/visual-screens.standard.spec.ts --workers=1

# All configured viewports (mobile + tablet + desktop)
cross-env VISUAL_CAPTURE_ROOT=docs/reference-comparison/captures yarn test:e2e:visual
```

Windows: `cross-env` is not always on the global PATH; from the repo use `npx cross-env VISUAL_CAPTURE_ROOT=docs/reference-comparison/captures yarn playwright test e2e/visual-screens.standard.spec.ts --workers=1`, or set `$env:VISUAL_CAPTURE_ROOT` in PowerShell as in "How the captures were produced", or invoke `.\node_modules\.bin\cross-env.cmd` directly.

Where outputs land: `test-results/**` is gitignored (including `test-results/endproduct-parity/` from the `PLAY-010` quick capture command). By contrast, `docs/reference-comparison/captures/` is a normal tracked tree when those PNGs are committed - regenerating there will dirty `git status`. Per [`VISUAL_REVIEW.md`](../new_design/VISUAL_REVIEW.md), commit those binaries only when intentionally refreshing design-review baselines; otherwise keep captures local, revert them, or attach artifacts to the PR.

Gitignore vs captures: the repo root [`.gitignore`](../../.gitignore) lists `test-results/` (and related Playwright report folders) but does not ignore `docs/reference-comparison/captures/`. Default visual runs therefore leave no tracked-tree noise; writing to `captures/` with `VISUAL_CAPTURE_ROOT` produces diffs only when that folder is meant to be updated.

If `visual-screens.standard` fails: retry `--workers=1`. Failures observed in the wild include Vite dropping mid-suite (`ERR_CONNECTION_REFUSED`) and `08-game-over` (level-1 mismatch discovery / hidden-tile timing). For marketing stills tied to desktop paths in this doc, a green `-g "desktop-landscape"` run may still stop on game-over; the dev-sandbox pair `e2e/hud-inspect.spec.ts` plus `e2e/visual-endproduct-parity.spec.ts` remains the reliable `PLAY-010` artifact source for HUD / board / card-state review.

Update this document when reference stills change or when new scenarios are added to [`e2e/visualScenarioSteps.ts`](../../e2e/visualScenarioSteps.ts).

**Capture policy (recorded):** default CI flow uses gitignored Playwright output. Optional committed PNGs under `docs/reference-comparison/captures/` only when intentionally updating design-review baselines - see [`VISUAL_REVIEW.md`](../new_design/VISUAL_REVIEW.md), "Recorded default".

---

## 7. Related internal docs

- [`docs/new_design/CURRENT_VS_TARGET_GAP_ANALYSIS.md`](../new_design/CURRENT_VS_TARGET_GAP_ANALYSIS.md) - structured feature / model gaps
- [`docs/new_design/REFERENCE_VS_SCENARIOS.md`](../new_design/REFERENCE_VS_SCENARIOS.md) - scenario naming map
- [`docs/new_design/VISUAL_REVIEW.md`](../new_design/VISUAL_REVIEW.md) - how to run visual checks and where outputs go by default
- [`docs/new_design/TASKS/TASKS_COMPLETION_LOG.md`](../new_design/TASKS/TASKS_COMPLETION_LOG.md) - which parity task IDs were closed vs still open
