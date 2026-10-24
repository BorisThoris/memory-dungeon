# DGE-030: Art, audio and the preload for every new surface

## Status
Done (2026-10-23): cues, board marks, three painted boss rooms, the Dread’s eye

## Priority
P1

## Phase
Cross-cutting

## Subsystem
HUD

## Depends on
- `DGE-002`

## Current repo context
- `src/renderer/assets/preloadRunAssets.ts`, `e2e/asset-streaming.spec.ts`, `cardElementFx.ts`, `sceneAmbient.ts`, `goldRain.ts`, the realm ambience jobs file `assets/audio/realm-ambience.jobs.json`, AGENTS.md §1 to §3, the local model inventory in CLAUDE.md.

## Problem
Each verb, family, boss and tier needs marks, decals, stingers and words, and nothing may stream in play.

## Target experience
Card-back marks for Wanderers, Masks and Sleepers; footprint and promotion decals; the Hold glow and release; the Dread chip art; three boss presentations with their one moving thing; stingers for Hold release, a Warden re-deal, a Sleeper wake and each tier change; all preloaded.

## Implementation notes
- Art: Z-Image-Turbo or SDXL, positive-only prompts, relightable layers, no backdrops on the ink-and-paper screens; record prompts beside the assets.
- Audio: ACE-Step through `.venv-audio` (evict the Ollama model first), chosen by measurement, levelled to -19.3 LUFS, recorded in the jobs file.
- Every file joins the preload; the streaming e2e holds post-board requests at zero.
- Anything the combo or the Hold meter drives climbs without end (AGENTS.md §2) and is tested out to thousands of links.

## Acceptance criteria
- `e2e/asset-streaming.spec.ts` passes with every new asset.
- Each boss room has its drift, mist, light and one event.
- Reduced motion has a still equivalent for every new motion.
- Tick the rows of `../04-mechanic-checklist.md` that apply in the handoff notes. The pre-commit list in CLAUDE.md runs before every commit.

## Tests and verification
- Asset streaming e2e; `audit:renderer-assets`; `audit:music-key` for any new music.

## Risks and edge cases
- Headless WebGL frame rate; measure, do not eyeball, the level of new stingers.

## Cross-links
- `../README.md`
- `../02-deep-game-plan.md`
- `../04-mechanic-checklist.md`
- `../03-execution-ledger.md`

## Future handoff notes
Leave next steps, checklist rows ticked, and known blockers here after implementation.

2026-10-22, the cue pass (no rules change).
- Nine procedural cues, `playDeepGameSfx` in `gameSfx.ts`, played from `applyResolvedRun` (turns, Hold releases, Reprises and floor changes all pass there): the Hold's release (a swell, then bells up the cascade's own A-minor scale, one per doubling held, capped at `CHUNK_BREAK_MAX_NOTES`), the Warden dealing again (a low gong under a riffle), the Keeper's swap (stone on stone), the Cartographer's turn (a heavy page), a Spiral ring sealing (a falling thud), a Sleeper waking (a breath and a low bell), a mask dropping (a glass tick), a Wanderer's step (one soft footfall), the Dread climbing a tier (a low fifth that swells). `deepGameCues` diffs the run's own counters, so nothing new is stored.
- Synthesised, not ACE-Step: short event cues in this game are procedural (the looking glass, the void spew), and a synthesised cue has no file to preload, so `asset-streaming.spec.ts` is untouched. Levels sit inside the existing realm cues' range (sum of voice gains 0.16 to 0.88 at 0.7 of the SFX gain, against the void spew's 1.9 and the looking glass's 0.8); not measured in LUFS, since there is no file.
- Registered in `audioInteractionCoverage.ts` (`deep_game_cues`), covered by the hostile-AudioContext sweep, and unit-tested (`deepGameCues.test.ts`: one cue per counter that grew, the Dread only on a new floor whose tier moved).
- Board marks (no files, three.js planes like `LayerEdges` and `FoldWall`, behind the cards, never picked): **`SpiralSeals.tsx`**, a slab of dark stone with a pale rim and two seams on every sealed cell, settling from 1.18x into place over half a second when its ring seals (still with reduced motion), so a fallen ring reads as stone and not as an empty cell; **`HoldSeeds.tsx`**, a gold ember outline and a gold diamond on each cell a held pair left, breathing, brighter with every pair held and never past full (`holdSeedGlow`, tested out to 4096 pairs), still with reduced motion. Layout and glow in `spiralSealLayout.ts`, unit-tested; both looked at in the isolated browser on a hall room at desk and phone size, no console errors.
- **Three boss rooms, painted** (the owner's choice over motion on the realm plates): **Z-Image-Turbo** on the 3090, `scripts/card-pipeline/boss-rooms.zimage.manifest.json`, three takes each, picks in `boss-rooms.zimage.picks.json` (the Hall of Doors c03, the Map Room c02, the Sealed Gate c03, whose rune ring reads as runes where c01's read as Latin letters). Prompts name places, never persons, positive-only. Real-ESRGAN x4 (`upscale_realms.py`), cut by `realm_layers.py --scale 2` with `realms.json` entries measured on a 10% grid: keeper lanterns and runes, cartographer moon, orrery and candles, warden cracks and runes (the first cut keyed too tight; the saturation and value ramps were opened until each family carried its light). Same namespace and pipeline as the realm rooms, no Blender passes.
- **In the game**: the scene's rooms widen to `SceneRoomId` (realms plus keeper, cartographer, warden; `RealmId`, a rules id, is untouched). A boss floor opens in its boss's room by its archetype (`bossRoomFor`), so Endless and the test pace find it; the realm's weather still strikes over it (`weatherRealm`); gold lands on each room's measured floor (`REALM_FLOORS`). Each room has its drift and mist (`bossRoomLifeDraws`: dust in the lantern light; motes in the moonlight; the Warden's floor mist, a live billow, and embers off its cracks), its lights on their own clocks and the combo, and **one event** off the boss's own counter (`SceneMood.bossEventKey`): the Keeper's swap gutters and flares the lanterns and shakes dust from the arches, the Cartographer's turn blazes the orrery and sweeps a light across the room, the Warden's deal darkens the room round its flaring cracks and drops ash. Reduced motion draws the lit room still. The floor-clear warm-up decodes the boss room before its floor; the run preloader takes every layer.
- **The Dread's eye**: an inline SVG on the Dread chip, shut at Quiet and opening a step a tier, red from Watching; no file.
- Checks: `bossRoomLife.test.ts`, `realmRoomArt.test.ts` (the boss room, its weather, its event key), the renderer suites (1,188), `audit:renderer-assets` (the new layers sit with the realm layers among the glob-loaded candidates), the CSS audits; **`e2e/asset-streaming.spec.ts` passes** in the isolated station; a look at all three rooms before and during their events at desk and phone size, no console errors. Judged from stills, not a real-time recording. Card-back marks for Wanderers, Masks and Sleepers stay out: the owner's rule that nothing face down sets a pair apart.

2026-10-24, the cues measured: each is rendered offline from the game's own code (an OfflineAudioContext behind the shared context, its delayed notes run at their times) and its loudest 50 ms compared with a match (-22 dB at full volume), a flip and a shuffle. The Hold's release sat 8 dB under a plain match, the Keeper and the Cartographer 9 and 14 under, and the Wanderer's step at -52 dB was under hearing (a 120 Hz floor). Raised: the release level with a match, the boss cues into the match's band, the Sleeper, the mask and the step 7, 12 and 15 dB under it (the step brighter, 1.4 kHz). Nothing clips with all eight on one turn (peak -13.6 dB). `e2e/deep-cue-levels.spec.ts` holds each to its band.
