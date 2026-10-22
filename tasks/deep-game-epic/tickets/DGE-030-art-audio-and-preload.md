# DGE-030: Art, audio and the preload for every new surface

## Status
In progress (2026-10-22): the cue pass done; the board marks next

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
- Not done yet: the board marks (a sealed Spiral ring, the Hold's glow on held pairs), the boss rooms' one moving thing, the Dread chip art. Card-back marks for Wanderers, Masks and Sleepers stay out: the owner's rule that nothing face down sets a pair apart.
