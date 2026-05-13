# REG-090 Choose Path Quality Rollout

schema: reg_090_quality_rollout.v1
scope: offline_local_steam_mobile_v1
online_policy: no mandatory accounts, no server realtime, no competitive online leaderboards

## Definition of done per screen

| screen | quality bar | data contract | verification route | dependent regs |
|---|---|---|---|---|
| main_menu | Play remains dominant; **Profile** opens the progress screen (stats/objectives/trust live there, not duplicated on the hub); no fake online links. | `SaveData`, `profile-summary`, `objective-board`, `quest-campaign` | `MainMenu.test.tsx`, visual `01-main-menu` / `01f-profile` | REG-009, REG-035, REG-091 |
| choose_path | Selected mode/start action above fold; browse/search/page state; locked reasons; poster fallback badges. | `run-mode-catalog`, `run-mode-discovery`, `challenge-progression` | `ChooseYourPathScreen.test.tsx`, navigation-flow for starts | REG-010, REG-013, REG-090 |
| collection | Reward signals, profile/meta board, honors, cosmetics, archive rows, readability rows. | `meta-progression`, `meta-reward-signals`, `daily-archive`, `cosmetics` | `meta-reward-signals.test.ts`, Collection smoke as added | REG-011, REG-016, REG-093 |
| inventory | Run snapshot, build value, consumable/loadout stack rules, economy rows, empty start guidance. | `RunState`, `run-inventory`, `run-economy`, `meta-reward-signals` | `InventoryScreen.test.tsx` | REG-011, REG-079, REG-094 |
| codex | Search/filter/tabs, glossary-consistent mechanics copy, reward/learning signal, in-run framing. | `mechanics-encyclopedia`, `localization-readiness` | `mechanics-encyclopedia.test.ts`, Codex tests when changed | REG-011, REG-055, REG-064 |
| settings | Sticky footer and scroll; honest future controls; save trust; premium economy; motion policy. | `Settings`, `settings-control-model`, `profile-summary`, `premium-economy-policy` | `SettingsScreen.test.tsx` | REG-006, REG-032, REG-036, REG-054, REG-092 |
| game_over | Above-fold outcome/action; local share-key/journal copy; daily result loop; no online rank. | `RunSummary`, `run-history`, `daily-archive` | `GameOverScreen.test.tsx` | REG-007, REG-023, REG-096 |

## Rollout order

1. Lock shared trust/data contracts before deeper polish: save/profile, social scope, premium economy, localization, glossary, asset pipeline.
2. Finish hub/meta surfaces: Main Menu, Choose Path, Collection, Inventory, Codex, Settings, Game Over.
3. Route every screen through viewport matrix and targeted tests before visual baseline refresh.
4. Defer final licensed art/audio/store media execution to release/package tickets while keeping placeholder slots documented.

## Placeholder and asset contract

placeholderNeeded: true

slots:
  - mode_posters: `src/renderer/assets/ui/modeArt.ts` custom/fallback manifest; non-bespoke modes may use fallback poster with visible badge.
  - ui_scenes: `UI_ART.menuScene`, `UI_ART.choosePathScene`, `UI_ART.gameplayScene`.
  - audio: `docs/AUDIO_INTERACTION_MATRIX.md` + runtime `audioInteractionCoverage.ts`; sampled cues fall back to procedural SFX.
  - card_textures: `textures/cards/authored-card-back.svg`, `front.svg`; hidden cards intentionally share one back.
  - store_media: deferred to REG-061; not bundled runtime.

fallbacks:
  - existing MetaFrame/Panel chrome
  - existing mode poster fallback raster
  - procedural Web Audio fallback
  - English-only copy modules
  - local/share-string social scope

bot_constraints:
  - do_not_generate_final_licensed_art_audio_or_legal_text
  - wire placeholders and stable manifests only
  - document exact acceptance slot and verification command

## Overlap ledger

| overlap | decision |
|---|---|
| REG-015/024 economy | temporary run currencies and shop wallet are gameplay systems, not monetization placeholders |
| REG-040 save trust | profile/save shell must show local-only persistence and failure recovery copy |
| REG-041/085 run history/share | share strings and local share keys are allowed; online rank remains deferred |
| REG-052 leaderboards | competitive online work is out of v1 quality bar |
| REG-013/059 assets | final art may be missing; fallback contracts must be visible and documented |

## Required validation

baseline:
  - yarn typecheck
  - yarn test

conditional:
  - Choose Path/navigation changes: `yarn vitest run src/shared/run-mode-discovery.test.ts src/renderer/components/ChooseYourPathScreen.test.tsx`
  - asset changes: `yarn audit:renderer-assets`
  - mechanics copy changes: `yarn docs:mechanics-appendix`
  - responsive visual changes: `yarn test:e2e:visual:smoke`
