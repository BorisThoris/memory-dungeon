# Renderer asset sources

Per [docs/new_design/ASSET_AND_ART_PIPELINE.md](../../docs/new_design/ASSET_AND_ART_PIPELINE.md), major art files note origin and license.

## Which module to import? (`AST-003`)

[`ui/index.ts`](ui/index.ts) exports **`UI_ART`** (shell / meta backgrounds and chrome). [`ui/modeArt.ts`](ui/modeArt.ts) exports **`MODE_CARD_ART`** (Choose Your Path posters; also re-exported from `index.ts`).

**Authoritative menu / gameplay scenes:** `UI_ART.menuScene`, `UI_ART.choosePathScene`, and `UI_ART.gameplayScene` in `index.ts` point at runtime **`ui/backgrounds/*.webp`** files. PNG files in the same folder are source masters. Legacy SVGs on disk (below) are not wired into the build.

## Asset inventory

| Path | Role | Source / tool | Notes |
|------|------|---------------|-------|
| `ui/backgrounds/bg-main-menu-cathedral-v1.webp` (`.png` master) | Main menu hero layer | AI-generated (Cursor image tool, project batch), then `yarn assets:ui-backgrounds:export-runtime-webp` | Fantasy vault; central negative space for title. **`GameOverScreen`** composites the same raster via `UI_ART.menuScene` behind the scrim (**META-002** shell parity). |
| `ui/backgrounds/bg-gameplay-dungeon-ring-v1.webp` (`.png` master) | Gameplay stage under board | AI-generated, then `yarn assets:ui-backgrounds:export-runtime-webp` | Memory ring / arena; board-safe center |
| `ui/backgrounds/bg-gameplay-arcane-workshop-v1.webp` (`.png` master) | Gameplay stage under board | Procedural local raster (Pillow), after OpenAI image API billing limit blocked live generation; then WebP export | Arcane workshop backdrop; dark center reserved for board readability. A painted Z-Image-Turbo alternative exists in `ui-backgrounds.zimage.manifest.json` (entry `bg-gameplay-arcane-workshop-v1`, alpha profile in `scripts/card-pipeline/masks/`) but is not shipped by choice. |
| `ui/backgrounds/bg-board-arcane-table-v1.webp` (`.png` master) | Gameplay board-stage workbench texture | Procedural local raster (Pillow), after OpenAI image API billing limit blocked live generation; then WebP export | Etched table / rune projection layer behind the tile board. A Z-Image-Turbo slate alternative exists in the same manifest (entry `bg-board-arcane-table-v1`) but is not shipped by choice. |
| `ui/backgrounds/bg-mode-classic-v1.webp` (`.png` master) | Mode card poster | AI-generated, then WebP export | Classic / blue-silver gate |
| `ui/backgrounds/bg-mode-daily-v1.webp` (`.png` master) | Mode card poster | AI-generated, then WebP export | Daily / purple crystal featured |
| `ui/backgrounds/bg-mode-endless-v1.webp` (`.png` master) | Mode card poster (locked) | AI-generated, then WebP export | Endless / ember gate, darker |
| `ui/backgrounds/bg-mode-gauntlet-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Brass clockwork wall and cyan hourglass / timed pressure |
| `ui/backgrounds/bg-mode-puzzle-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Ordered rune-tile grid on a crypt altar |
| `ui/backgrounds/bg-mode-mirror-puzzle-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Mirrored hall with rune windows over a reflecting pool |
| `ui/backgrounds/bg-mode-wild-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Volatile violet crystal scattering cards |
| `ui/backgrounds/bg-mode-practice-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Calm study alcove, lantern and a row of cards |
| `ui/backgrounds/bg-mode-scholar-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Vaulted library, glowing grimoire on a lectern |
| `ui/backgrounds/bg-mode-pin-vow-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | War-room map pinned with gold pins and cyan threads |
| `ui/backgrounds/bg-mode-meditation-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Floating card above a still cavern pool |
| `ui/backgrounds/bg-mode-pass-and-play-v1.webp` (`.png` master) | Mode card poster | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Round table, four chairs, fanned gold-backed cards; previously a WebP-only procedural placeholder. |
| `ui/backgrounds/mode-dungeon-showcase.webp` (`.png` master) | Mode card poster (`dungeon_showcase`) | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` | Horned shadow in a cyan archway behind a ring of cards. |
| `../../../build/icon.png` | Electron / Steam app icon (1024²) | Local **Z-Image-Turbo** batch (`yarn ui-art:local`, take in `ui-backgrounds.zimage.picks.json`), then `yarn assets:ui-backgrounds:export-runtime-webp` (`app-icon-memory-dungeon` entry) | Gold-framed card back with a cyan crystal; replaces the lettered placeholder tile. |
| `ui/backgrounds/bg-mode-placeholder-v1.webp` (`.png` master) | Mode card poster (fallback) | Copy of `bg-mode-endless-v1.png`, then WebP export | Only the explicit `fallback` poster key uses this shared placeholder; live catalog keys point at dedicated rasters. |
| `ui/backgrounds/bg-choose-path-stage-ambient-v2.webp` (`.png` master) | Choose Your Path hero layer (**shipped**) | AI / external (`image_gen.mjs`); path wired from [`ui/index.ts`](ui/index.ts), then WebP export | `ChooseYourPathScreen` soft-light layer over gameplay base. |
| `ui/backgrounds/bg-choose-path-stage-v1.webp` (`.png` master) | Choose Your Path procedural preview/runtime scene | `node scripts/generate-choose-path-background.mjs`, then WebP export | Mid-res procedural plate (~800×500); imported by `UI_ART.choosePathScene`. |
| `ui/brand-crest.svg` | Menu crest | Authored SVG | Crystal sigil in gold frame; reused on **GameOver** hero lockup (**META-002**). |
| `ui/menu-emblem.svg` | Secondary emblem | Authored SVG | Ring + tome motif |
| `ui/divider-ornament.svg` | Hero divider | Authored SVG | Gold gradient + center gem + side flourishes |
| `ui/icons/icon-inventory-bag-v1.svg` | Gameplay left rail / flyout inventory glyph | Authored SVG | `currentColor` strokes; barrel in `ui/icons/index.ts` |
| `ui/icons/icon-codex-book-v1.svg` | Gameplay left rail / flyout codex glyph | Authored SVG | Same |
| `ui/icons/icon-main-menu-v1.svg` | Gameplay left rail main menu (abandon) glyph | Authored SVG | Same |
| `ui/icons/icon-menu-hamburger-v1.svg` | Utility flyout toggle | Authored SVG | Same |
| `ui/icons/icon-fit-board-v1.svg` | Mobile fit-board control | Authored SVG | Same |
| `ui/icons/icon-pause-v1.svg` / `icon-play-v1.svg` | Pause / resume rail | Authored SVG | Same |
| `ui/icons/icon-settings-v1.svg` | In-run settings (toolbar) | Authored SVG | Same |
| `ui/icons/icon-shuffle-v1.svg` | Board power: shuffle | Authored SVG | Same |
| `ui/icons/icon-pin-v1.svg` | Board power: pin mode | Authored SVG | Same |
| `ui/icons/icon-destroy-v1.svg` | Board power: destroy pair | Authored SVG | Same |
| `ui/icons/icon-peek-v1.svg` | Board power: peek | Authored SVG | Same |
| `ui/icons/icon-stray-v1.svg` | Board power: stray remove | Authored SVG | Same |
| `ui/icons/icon-undo-v1.svg` | Resolving-phase undo | Authored SVG | Same |
| `ui/icons/icon-score-parasite-crystal.svg` | HUD score parasite mutator crystal glyph | Authored SVG | **HUD-007:** arcane-violet / gold-rim crystal aligned to `VISUAL_SYSTEM_SPEC` + `theme.ts` `--theme-hud-parasite-*`; used in `GameplayHudBar.tsx` (`?url` import). |
| `ui/frames/hud-segment-ornament.svg` | HUD score segment flourish | Authored SVG | Hex motif; used in `GameScreen.module.css` |
| `textures/cards/authored-card-back.svg` | Tile **hidden** side (default runtime) | Shared authored SVG card back; wired from `tileTextures.ts` and `TileBoardScene.tsx`. WebGL merged mesh when under byte/vertex caps ([`cardSvgPlaneGeometry.ts`](../components/cardSvgPlaneGeometry.ts)). | Primary card back source; every hidden card uses this same asset. |
| `textures/cards/back.svg` | Legacy hidden-side trace | SVG Storm-style trace | Shelf stock only; not the default runtime card back. |
| `textures/cards/front.svg` | Face-up panel (default runtime) | Traced front; pairs with the shared hidden-side SVG at runtime | Same atomic SVG pipeline. |
| `textures/cards/authored-card-front.svg` | Alternate face panel reference (optional) | Hand-authored stone frame + center well | Shelf stock only; hidden card backs are intentionally single-style. |
| _(not in repo)_ `tmp/card-backs-normalized/` | Local SDXL batch card-back experiments | `yarn card-backs:local` → [`batch_local_card_backs.py`](../../../scripts/card-pipeline/batch_local_card_backs.py); manifest [`generated-backs-last-run.json`](../../../scripts/card-pipeline/generated-backs-last-run.json) | Gitignored temp output only; runtime intentionally uses one shared card back. |
| `textures/cards/edge.png` | Card edge map | `scripts/card-pipeline/generate-card-textures.ps1` | Pairs with `tileTextures.ts` |
| `textures/cards/panel-roughness.png` | Panel roughness | `scripts/card-pipeline/generate-card-textures.ps1` | |
| `textures/cards/edge-roughness.png` | Edge roughness | `scripts/card-pipeline/generate-card-textures.ps1` | |
| `textures/cards/back-normal.webp`, `front-normal.webp` (`.png` masters retained) | Runtime card normal maps | `yarn card-normals:export-runtime-webp` from generated PNG normal maps | Imported by `tileTextures.ts`; PNG masters are retained for regeneration/reference. |
| `textures/cards/reference-back.png` | Card-back **pipeline source** (normalize / PS1 raster steps) | Authored / AI → normalize | Default input for [`generate-card-textures.ps1`](../../../scripts/card-pipeline/generate-card-textures.ps1); **not** the runtime `authored-card-back.svg` URL in `tileTextures.ts`. |
| `textures/cards/front-face.png` | Card-face **pipeline output** / plate reference | Same PS1 pipeline from `reference-back.png` | Runtime faces still use `front.svg` + illustration mats unless you replace imports. |
| `cards/illustrations/face-panel-01.webp` … `face-panel-80.webp` (`.png` masters retained) | Tarot illustration **mat** runtime rasters (center panel), tiered common/uncommon/rare | `yarn face-panels:local` → [`batch_local_face_panels.py`](../../../scripts/card-pipeline/batch_local_face_panels.py) (SDXL, gold–cyan brief matching the main-menu shell), then `yarn face-panels:export-runtime-webp`; URL barrel [`facePanelRasterUrls.ts`](../cardFace/facePanelRasterUrls.ts). An alternative full-bleed **Z-Image-Turbo** set exists behind `yarn face-panels:local:zimage` / `face-panels:install:zimage` (`face-panels.zimage.manifest.json`) but is **not** shipped: the gold–cyan SDXL fronts are the intended card style. | Weighted fallback in [`weightedFacePanelPool.ts`](../cardFace/weightedFacePanelPool.ts); slot order 01-48 common, 49-72 uncommon, 73-80 rare is fixed. Legacy `deck-01..06.svg` stay referenced for `yarn build:card-illustration-manifest`. |
| _(not in repo)_ `tmp/face-panels/` | Local SDXL batch staging | Same | Gitignored until copied into `cards/illustrations/`. |

### Card faces: atomic SVG vs overlay FX

`authored-card-back.svg` / `front.svg` are treated as **one drawable** everywhere it matters for gameplay parity:

- **WebGL:** [`tileTextures.ts`](../components/tileTextures.ts) loads each side as a single URL; [`cardSvgPlaneGeometry.ts`](../components/cardSvgPlaneGeometry.ts) merges paths into one plane mesh per side (vertex cap in that file).
- **DOM:** [`TileBoard.module.css`](../components/TileBoard.module.css) uses each file as a full-bleed `background-image` on `.cardBack` / `.cardFaceFront`.

**Independent motion or glow** on motifs is **not** done by parsing those SVGs into React subtrees; both DOM and WebGL use the same atomic raster/SVG layers plus existing tint and overlay textures from `tileTextures.ts`.

## Typography (self-hosted)

| Package | License | Usage |
|---------|---------|--------|
| `@fontsource/cinzel` | OFL-1.1 | Display / titles via `global.css` |
| `@fontsource/source-sans-3` | OFL-1.1 | UI + body via `global.css` |

Latin subsets only to limit bundle size.

## Gameplay icon set (`AST-006`)

**Left rail / board powers:** authored SVGs under [src/renderer/assets/ui/icons/](ui/icons/) with barrel [index.ts](ui/icons/index.ts); consumed from `GameLeftToolbar` as `<img>` (`.toolbarGlyphImg`).

**Main menu / settings:** still use `<img>` and assets from the shell `UI_ART` barrel or screen-local paths—not this icons folder. If menu rows gain circular icon buttons that must match the gameplay rail stroke weight, extend **`ui/icons/`** (and this table) or add a small `menuIcons` barrel rather than forking a second SVG style.

**Legacy stroke components:** [src/renderer/ui/gameplayIcons.tsx](../ui/gameplayIcons.tsx) remains for any non-toolbar consumers and re-export from [src/renderer/ui/index.ts](../ui/index.ts).

## Regenerating rasters with OpenAI

With `OPENAI_API_KEY` set:

```bash
# Print exact card PNG dimensions for a given long edge (default 2048)
yarn card-texture:ideal
yarn card-texture:ideal 3072

# Menu / wide hero (default if you omit resolution)
yarn imagegen -- --prompt "YOUR PROMPT" --out src/renderer/assets/ui/backgrounds/name.png

# Optional raster back (if not using `authored-card-back.svg`): API 1024×1536 → trim → normalize to exact 0.74:1.08
# yarn imagegen … --out tmp/card-back-raw.png
# yarn png:trim-bbox tmp/card-back-raw.png tmp/card-back-trimmed.png --pad 2
# powershell … normalize-card-texture.ps1 … -OutputPath src/renderer/assets/textures/cards/some-back.png

# Vector sides: edit `authored-card-back.svg` / `front.svg` (also `?url` imports in `tileTextures.ts`). WebGL builds merged meshes in `cardSvgPlaneGeometry.ts`.
```

In-game mapping is **contain** (not cover): full illustration stays visible; stretch is avoided so filigree/gems stay round.

Square **1024×1024** (icons / non-card): `--resolution card` or `square`. Explicit size: `--size 1536x1024` (overrides `--resolution`).

Presets: `yarn imagegen -- --list-resolutions`. Optional `--quality low|medium|high|auto` for `gpt-image-*`.

Add or update a row in this table when you replace a file.
