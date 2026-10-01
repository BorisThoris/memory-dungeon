# Sampled gameplay SFX (optional)

[`manifest.json`](manifest.json) lists logical keys to runtime filenames. Manifest entries should point at OGG files; WAV files in this folder are source masters and are intentionally ignored by the eager runtime glob. Runtime decode failures fall back to procedural Web Audio in [`gameSfx.ts`](../../../audio/gameSfx.ts), but manifest entries must point to existing files. `yarn audit:renderer-assets` and `src/renderer/audio/gameSfx.test.ts` fail when a listed SFX file is missing.

## Filenames

| Key | Default file |
|-----|--------------|
| flip | `flip.ogg` |
| gambitCommit | `gambit-commit.ogg` |
| match-tier-low | `match-tier-low.ogg` |
| match-tier-mid | `match-tier-mid.ogg` |
| match-tier-high | `match-tier-high.ogg` |
| mismatch | `mismatch.ogg` |
| power-arm | `power-arm.ogg` |
| peek-power | `peek-power.ogg` |
| shuffle-full | `shuffle-full.ogg` |
| shuffle-quick | `shuffle-quick.ogg` |
| floor-clear | `floor-clear.ogg` |
| realm-fire-1 | `realm-fire-1.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-fire-2 | `realm-fire-2.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-fire-3 | `realm-fire-3.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-burnout | `realm-burnout.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-ice-1 | `realm-ice-1.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-ice-2 | `realm-ice-2.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-ice-3 | `realm-ice-3.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-wind | `realm-wind.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-water-1 | `realm-water-1.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-water-2 | `realm-water-2.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-douse | `realm-douse.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-lightning-1 | `realm-lightning-1.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-lightning-2 | `realm-lightning-2.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-static | `realm-static.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |
| realm-earth | `realm-earth.ogg` (CC0 recording, see [ASSET_SOURCES](../../ASSET_SOURCES.md)) |

Match streak depth maps to low / mid / high in `manifest.json`.

## UI and menu SFX

Focused UI/menu one-shots live in [`../ui/`](../ui/README.md): click, confirm, back, counter, menu-open, run-start, intro-sting, pause-open, pause-resume, game-over-open, and ui-copy.

## Pipeline

Generate offline with ACE-Step, trim to tight one-shots, normalize, keep WAV masters, and export OGG runtime files. Use `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` for the full app-audio batch, or `jobs.sfx.example.json` for the smaller gameplay-only example.
