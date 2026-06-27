# Audio integration (desktop)

Ultra-deep table of every shipped sound (style, duration, references, coupling): [AUDIO_ASSET_INVENTORY.md](./AUDIO_ASSET_INVENTORY.md).

**Status:** Volume sliders persist via `Settings` / `save-data.ts`. **Gameplay SFX** uses **Web Audio**: sampled OGG one-shots from [`src/renderer/assets/audio/sfx/`](../src/renderer/assets/audio/sfx/README.md) when files are present, with procedural oscillators as decode/missing-asset fallback. Effective gain is `masterVolume * sfxVolume`.

**UI/menu SFX** uses the same shared renderer `AudioContext` through [`uiSfx.ts`](../src/renderer/audio/uiSfx.ts). It covers focused navigation and confirmation cues: click, confirm, back, counter, menu-open, and run-start.

**Background music** uses an `HTMLAudioElement` loop ([`gameplayMusic.ts`](../src/renderer/audio/gameplayMusic.ts)): gain is `masterVolume * musicVolume`. Playback runs while `visualView` is `menu` or `playing`. Release playback uses OGG loops (`menu-loop.ogg`, `run-loop.ogg`) while WAV masters remain in the asset folder for regeneration/reference. Other views pause the track. Browser autoplay rules still apply, so the hook retries after the first `pointerdown`.

## Current wiring

| Event | Where | Module |
|-------|-------|--------|
| Flip | After a successful `flipTile` in `pressTile` | `gameSfx.ts` -> `playFlipSfx` |
| Match / mismatch | When `resolveBoardTurn` runs | `playResolveSfx` |
| Powers / shuffle / floor clear | Store and board power paths | `gameSfx.ts` |
| UI/menu navigation | Main menu, mode select, settings, codex | `uiSfx.ts` |
| Run start / restart | Store run creation paths | `playRunStartSfx` |

`resumeAudioContext()` is called after tile presses and resolve ticks so a suspended context can resume before gameplay cues. UI/menu SFX calls `resumeUiSfxContext()` at focused navigation/action points.

## Files

- `src/renderer/audio/webAudioContext.ts` - shared `AudioContext` for procedural + sampled playback
- `src/renderer/audio/sampledSfx.ts` - manifest-driven gameplay sample decode + buffer playback
- `src/renderer/audio/gameSfx.ts` - sampled-first gameplay one-shots with procedural fallback
- `src/renderer/audio/uiSfx.ts` - sampled-first UI/menu one-shots with procedural fallback
- `src/renderer/audio/gameplayMusic.ts` - menu/run background loop selection + volume + view gating
- `src/renderer/assets/audio/sfx/manifest.json` - gameplay keys to filenames + match tier ranges
- `src/renderer/assets/audio/ui/manifest.json` - UI/menu keys to filenames
- `src/renderer/assets/audio/music/` - runtime `menu-loop.ogg` / `run-loop.ogg` plus WAV masters

## Asset Set

Gameplay SFX: `flip`, `gambit-commit`, `match-tier-low`, `match-tier-mid`, `match-tier-high`, `mismatch`, `power-arm`, `destroy-pair`, `peek-power`, `stray-power`, `shuffle-full`, `shuffle-quick`, `floor-clear`, `relic-offer-open`, `relic-pick`, `wager-arm`, and `countdown-pressure`.

UI/menu SFX: `ui-click`, `ui-confirm`, `ui-back`, `ui-counter`, `menu-open`, `run-start`, `intro-sting`, `pause-open`, `pause-resume`, `game-over-open`, and `ui-copy`.

Music: `menu-loop.ogg` and `run-loop.ogg` for runtime playback; `menu-loop.wav` and `run-loop.wav` are retained as source masters.

## Offline generation

Use `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` for the full app-audio ACE-Step batch. Reference audio paths are under `scripts/audio-pipeline/reference-audio/` (run `yarn audio:prep-ace-app` for procedural stubs, or add licensed originals per `reference-audio/README.md`) with conservative `audio_cover_strength` values. Raw renders land under `tmp/audio/ace-step/`; trim one-shots, normalize, and copy finals into:

- `src/renderer/assets/audio/sfx/`
- `src/renderer/assets/audio/ui/`
- `src/renderer/assets/audio/music/`

Regenerate checked-in procedural WAV masters after manifest edits with `yarn audio:placeholders`, then export runtime OGG files before shipping.

## QA

Verify packaged Windows builds with master/music/SFX sliders at audible levels. Confirm menu navigation, run start, flip, match, mismatch, powers, shuffle, floor clear, and menu/run music switching after a normal user gesture.
