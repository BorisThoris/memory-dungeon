# DGE-030: Art, audio and the preload for every new surface

## Status
Not started

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
