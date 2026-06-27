# Drop-in asset checklist (renderer)

Use this when final art is ready. Swap files **or** update imports in `src/renderer/assets/ui/index.ts` / `tileTextures.ts` to point at new URLs. Keep fallbacks until assets are verified on device.

## Menu and gameplay scenes ([TASK-009](TASKS/TASK-009-final-menu-and-gameplay-illustrations.md); playing stage parity **PLAY-006** in [`PLAYING_ENDPRODUCT/04-environment-stage.md`](TASKS/PLAYING_ENDPRODUCT/04-environment-stage.md))
| Role | Typical import / usage |
|------|-------------------------|
| Menu hero layer | `UI_ART.menuScene` — runtime `src/renderer/assets/ui/backgrounds/bg-main-menu-cathedral-v1.webp` (`.png` master retained; see [`ui/index.ts`](../../src/renderer/assets/ui/index.ts)) |
| Gameplay stage | `UI_ART.gameplayScene` — runtime `src/renderer/assets/ui/backgrounds/bg-gameplay-dungeon-ring-v1.webp` (`.png` master retained) |
| Stage ring (optional) | `UI_ART.stageRing` |
| Ambient field | `MainMenuBackground.tsx` — procedural; optional texture pass |

## Logo / emblem ([TASK-010](TASKS/TASK-010-final-logo-and-emblem-lockup.md))
| Role | Typical import |
|------|----------------|
| Crest | `UI_ART.brandCrest` |
| Menu emblem | `UI_ART.menuEmblem` |
| Divider | `UI_ART.dividerOrnament` |

## Card raster (**PLAY-007** — [`PLAYING_ENDPRODUCT/05-cards.md`](TASKS/PLAYING_ENDPRODUCT/05-cards.md); optional AI path [`CARD_TEXTURE_AI_BRIEF.md`](CARD_TEXTURE_AI_BRIEF.md))
| Role | File / import |
|------|----------------|
| Hidden-side card art | `authored-card-back.svg` — `tileTextures.ts` (`cardReference`), `cardSvgPlaneGeometry.ts`, DOM/WebGL hidden back |
| Face-up panel art | `front.svg` — `tileTextures.ts` (`cardFace`), DOM `.cardFaceFront` / `.faceUp .cardBack` |
| Edge / roughness | `edge.png`, `panel-roughness.png`, `edge-roughness.png` |

## Mode cards ([TASK-018](TASKS/TASK-018-mode-select-card-illustrations.md))
| Role | Implementation |
|------|------------------|
| Per-mode illustration | Add assets under `src/renderer/assets/ui/` (or `backgrounds/`) and mount inside `ChooseYourPathScreen` cards |

## Naming (see also)
[ASSET_AND_ART_PIPELINE.md](ASSET_AND_ART_PIPELINE.md) — recommended filenames and formats.

## After swap
- Run `yarn test` and `yarn test:e2e:visual` (or targeted specs).
- Check `reduceMotion` and low-DPR laptops for load and sharpness.

## REG-059 machine gates
- Source paths and fallback behavior are mirrored in `src/renderer/assets/assetDropInReadiness.ts`.
- Run `yarn audit:renderer-assets` after adding/replacing renderer files; it must report no unreferenced candidates or the candidates must be documented as intentional shelf stock in `ASSET_SOURCES.md`.
- Every final replacement must update source/rights rows in `src/renderer/assets/ASSET_SOURCES.md` before visual baseline refresh.
