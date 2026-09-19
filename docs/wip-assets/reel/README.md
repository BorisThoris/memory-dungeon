# Frozen generative inputs for the reel

Outputs of the local generative models, kept so `scripts/reel-pipeline/reel.sh` rebuilds the reel without
touching a GPU. Every file here is listed in `scripts/reel-pipeline/frozen.sha256`.

## zimage/ — Z-Image-Turbo (Tongyi-MAI/Z-Image-Turbo), manifest `scripts/reel-pipeline/zimage/reel.zimage.manifest.json`

| file | entry | seed | candidate | used as |
| --- | --- | --- | --- | --- |
| `hero-face-chalice-c02.png` | `hero-face-chalice` | 77010 | c02 of 2 | hero card face (chalice) |
| `hero-face-tower-c01.png` | `hero-face-tower` | 77020 | c01 of 2 | hero card face (tower) |
| `hero-face-serpent-c02.png` | `hero-face-serpent` | 77030 | c02 of 2 | hero card face (serpent) |
| `hero-face-crystal-c02.png` | `hero-face-crystal` | 77040 | c02 of 2 | hero card face (crystal) |
| `plate-corridor-c01.png` | `plate-corridor` | 77100 | c01 of 2 | plate behind the Blender shots |
| `plate-corridor-c02.png` | `plate-corridor` | 77100 | c02 of 2 | plate behind the gameplay board |
| `plate-cathedral-c01.png` | `plate-cathedral` | 77200 | c01 of 2 | end-card plate |

Steps 8, 1136×1296, `--cpu-offload`. Candidates are numbered in render order; the pick per entry was made by eye.

## ace/ — ACE-Step 1.5 (`acestep-v15-xl-turbo`, LM `acestep-5Hz-lm-1.7B`)

`score/score-hybrid-v02-seed621020.wav` — job `score-hybrid` from `scripts/reel-pipeline/ace/jobs-score.json`, variant 2, seed 621020, uuid `b44d7006-1bcc-9b02-7323-a952a647b2b4`.
Chosen over the earlier pick (choral v03) because that take was clipped at generation (crest 6–7 dB, ~9.7k flat samples in its last 4 s).
The pipeline de-clips it (`adeclip`) and delays it 647 ms so its hit (5.02 s) lands on the pop (5.67 s).

`fx/` — one raw 4 s take per effect kind from `jobs-fx.json` (4 seeds each, ranked by `ace/pick_fx.py`), with `picks.json`
(onset time, levels, seed, variant). `ace/fx_shape.py` cuts each at its onset and shapes it into a one-shot.

| kind | file | variant | seed | onset s |
| --- | --- | --- | --- | --- |
| fx-card-flip | `fx-card-flip-seed635839.wav` | v03 | 635839 | 4.58 |
| fx-card-whoosh | `fx-card-whoosh-seed635939.wav` | v03 | 635939 | 3.84 |
| fx-reveal | `fx-reveal-seed620201.wav` | v01 | 620201 | 3.36 |
| fx-match | `fx-match-seed644058.wav` | v04 | 644058 | 2.28 |
| fx-clump-pop | `fx-clump-pop-seed620401.wav` | v01 | 620401 | 3.44 |
| fx-floor-clear | `fx-floor-clear-seed628420.wav` | v02 | 628420 | 0.22 |
| fx-riser | `fx-riser-seed636439.wav` | v03 | 636439 | 3.48 |
| fx-logo-boom | `fx-logo-boom-seed628620.wav` | v02 | 628620 | 3.32 |
