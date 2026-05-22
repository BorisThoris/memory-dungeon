# Sampled gameplay SFX (optional)

[`manifest.json`](manifest.json) lists logical keys to filenames. Drop matching OGG or WAV files next to this README. Vite bundles only files that exist; missing files fall back to procedural Web Audio in [`gameSfx.ts`](../../../audio/gameSfx.ts).

## Filenames

| Key | Default file |
|-----|--------------|
| flip | `flip.wav` |
| gambitCommit | `gambit-commit.wav` |
| match-tier-low | `match-tier-low.wav` |
| match-tier-mid | `match-tier-mid.wav` |
| match-tier-high | `match-tier-high.wav` |
| mismatch | `mismatch.wav` |
| power-arm | `power-arm.wav` |
| destroy-pair | `destroy-pair.wav` |
| peek-power | `peek-power.wav` |
| stray-power | `stray-power.wav` |
| shuffle-full | `shuffle-full.wav` |
| shuffle-quick | `shuffle-quick.wav` |
| floor-clear | `floor-clear.wav` |
| relic-offer-open | `relic-offer-open.wav` |
| countdown-pressure | `countdown-pressure.wav` |
| relic-pick | `relic-pick.wav` |
| wager-arm | `wager-arm.wav` |

Match streak depth maps to low / mid / high in `manifest.json`.

## UI and menu SFX

Focused UI/menu one-shots live in [`../ui/`](../ui/README.md): click, confirm, back, counter, menu-open, run-start, intro-sting, pause-open, pause-resume, game-over-open, and ui-copy.

## Pipeline

Generate offline with ACE-Step, trim to tight one-shots, normalize, and export OGG/WAV. Use `scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json` for the full app-audio batch, or `jobs.sfx.example.json` for the smaller gameplay-only example.
