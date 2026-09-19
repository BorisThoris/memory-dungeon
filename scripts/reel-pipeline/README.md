# The Instagram reel, rebuilt deterministically

A 10 s, 9:16, 60 fps commercial for Memory Dungeon: two Blender card shots, a seeded gameplay
take of a real run, a floor-clear colophon and an end card, scored and sound-designed with local
models. Everything the reel needs is pinned in this directory and in `docs/wip-assets/reel/`, so
the same command rebuilds the same reel later — after the app has moved on, on this machine or a
similar one.

```bash
bash scripts/reel-pipeline/reel.sh          # rebuild everything that is not built yet
bash scripts/reel-pipeline/reel.sh verify   # check the frozen inputs are intact
```

Output: `$REEL_BUILD/out/memory-dungeon-reel-10s.mp4` (+ the master and premaster WAVs, the
arc gain curve and `mastering-report.png`). `REEL_BUILD` defaults to
`~/Desktop/memory-dungeon-reel/build`; it is a cache, nothing in it is precious.

## What is pinned where

| Stage | Inputs pinned | Where |
| --- | --- | --- |
| Gameplay take | run share key `md1:classic:49:20260919` (variant, rules version, seed) — replays the same board under rules v49 forever; capture epoch `1700000000000`, page `Math.random` seed `20260919`; 60 fps, DPR 3, JPEG q95, plate opacity 0.62 | `reel.sh`, `capture/` |
| Blender shots | `blender_reel.py` (mote seeds 3 and 11), 64 samples, subframe ×2; card faces/back/plate from the cards stage | `reel.sh`, `blender_reel.py` |
| Cards | which Z-Image candidate feeds each face and plate (`FACE_*`, `PLATE_*`), crops, the gold-frame keying; copy lines | `reel.sh`, `compose_card.py`, `cards2.mjs`, `lines.json` |
| Z-Image plates and faces | prompts + seeds (`77010`…) | `zimage/reel.zimage.manifest.json`; renders frozen in `docs/wip-assets/reel/zimage/` |
| ACE-Step score and effects | prompts, bpm/key, per-variant seeds; the picked takes | `ace/jobs-*.json`; picks frozen in `docs/wip-assets/reel/ace/` with `picks.json` |
| Edit | derived from the take's frame-exact marks (`edit60.mjs`) | — |
| SFX stem | per-kind levels, pitch-variation PRNG seed 11, positions from Blender + the take | `fx_stem60.py` |
| Mix | music hit 5.02 s, gains 0.7 / 1.0, duck 2.2:1, grain PRNG seed 20260919, x264 slow crf 17 8 threads, bit-exact muxing | `build60.sh` |
| Master | designed loudness arc, EQ, width, glue, end-card sub trim, adaptive limiter ceiling, two-pass linear loudnorm −14 LUFS / −1 dBTP | `master2.sh`, `arc.py` |

`frozen.sha256` lists every frozen generative input; `reel.sh verify` checks them.

## Determinism, measured (2026-09-20, this machine)

- **Take.** Two DPR-1 captures of `md1:classic:49:20260919` → `marks.json` byte-identical: same
  board, same picks, flips at frames 304/334/424/454/544/574, Sharp at 478, clear at 614. Frames are
  not byte-identical: ~0.03 % of pixels differ (max 4.3k of 518k in one frame, all inside animated
  card faces during the reveal — a sub-frame phase difference from asynchronous image decoding).
  Before the constant-epoch fix it was ~1 % with 1e-11 noise in every rect. `reel.sh probe` repeats
  this check.
- **Blender.** Hero frames pixel-identical to the previous render; board frames within ±1 LSB.
- **Everything after the take** is bit-identical run to run: `timeline.json`, the SFX stem, the
  de-clipped score, the decoded video of the mix, the master WAV and the final MP4 (three
  consecutive `mix` runs → one hash). Two ffmpeg races had to be closed for that: `noise` grain
  seeded (`all_seed`), and both audio stems padded to the same length before they meet, because
  the compressor/mixer flush at EOF differed run to run in the last ~100 ms.

What is *not* bit-reproducible, by nature: the generative models. Z-Image-Turbo and ACE-Step are
seeded, so re-rolling gives the same family of results, but GPU kernels are not bit-exact across
driver/library versions. That is why their outputs are frozen in the repo and the pipeline starts
from the frozen files. `gen-images`, `gen-audio`, `gen-copy` exist for re-rolling on purpose.

## Tools it expects (override by env)

- `BLENDER` — Blender 4.3 (`E:/Program Files/Blender Foundation/Blender 4.3/blender.exe`)
- `REEL_PY` — a Python with numpy + Pillow (`py -3.12`)
- `REEL_PY_AUDIO` — a Python with numpy + soundfile (`.venv-audio/Scripts/python.exe`)
- `ffmpeg`/`ffprobe` with libx264, libwebp; `node` + the repo's `node_modules` (Playwright, Chromium)
- `REEL_BASE_URL` — the renderer dev server (`reel.sh` starts `yarn vite` on 127.0.0.1:5217 if it is down)
- for the generative stages only: the Z-Image runner (`scripts/card-pipeline/batch_local_zimage.py`,
  HF cache on `D:\hf-cache`) and ACE-Step 1.5 via `yarn audio:ace-step:batch` with
  `CROSS_REPO_LIBS_ROOT` / `ACESTEP_PYTHON` / `ACESTEP_PROJECT_ROOT`

## Picking up later

The app keeps changing, and the take is the only stage that looks at it. The share key pins the
board under rules v49, but the *look* of the run shell follows the current code — that is
intended: rebuilding after a UI change gives the reel with the new UI, same run, same cut. If the
scenario's hooks move (`data-testid="run-shell"`, `hud-*`, `floor-clear-beat`, the
`__e2e*Grid1` window hooks, the shared-run form `choose-path-shared-run`), fix
`capture/scenarios/reel-floor2.mjs` first; `capture.mjs` itself only needs Chromium.

Lessons that cost a re-take each are in the memory note `reel-pipeline-lessons`; the most
important: never grant the next virtual-time budget before the last expired, keep `frameTimeTicks`
on the same base as `initialVirtualTime`, and rank generated audio takes by crest factor and
flat-sample count, not only by structure — ACE-Step can hand back a take that is already clipped.
