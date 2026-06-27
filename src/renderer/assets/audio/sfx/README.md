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
| destroy-pair | `destroy-pair.ogg` |
| peek-power | `peek-power.ogg` |
| stray-power | `stray-power.ogg` |
| shuffle-full | `shuffle-full.ogg` |
| shuffle-quick | `shuffle-quick.ogg` |
| floor-clear | `floor-clear.ogg` |
| relic-offer-open | `relic-offer-open.ogg` |
| countdown-pressure | `countdown-pressure.ogg` |
| relic-pick | `relic-pick.ogg` |
| wager-arm | `wager-arm.ogg` |

Match streak depth maps to low / mid / high in `manifest.json`.

## UI and menu SFX

Focused UI/menu one-shots live in [`../ui/`](../ui/README.md): click, confirm, back, counter, menu-open, run-start, intro-sting, pause-open, pause-resume, game-over-open, and ui-copy.

## Pipeline

Generate offline with ACE-Step, trim to tight one-shots, normalize, keep WAV masters, and export OGG runtime files. Use `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` for the full app-audio batch, or `jobs.sfx.example.json` for the smaller gameplay-only example.
