# ACE-Step 1.5 — local audio batch (dev-only)

Offline music generation with [ACE-Step 1.5](https://github.com/ace-step/ACE-Step-1.5): text prompts, optional **reference / source** audio for style or cover-style tasks. Outputs go to `tmp/audio/ace-step/` (gitignored), same idea as `scripts/card-pipeline/` + SDXL.

## Prerequisites

- **Python 3.11 or 3.12** (required by upstream; use a **dedicated venv** — do not reuse the SDXL/card venv if it is 3.10).
- **NVIDIA GPU**, **CUDA 12.8** stack matching the PyTorch wheels ACE-Step pins on Windows (see upstream `pyproject.toml`).
- **24 GB VRAM** is enough for the default turbo + LM path without aggressive offload; upstream may still auto-offload depending on LM size—see their CLI logs.

### Windows GPU one-time setup (recommended)

Use a **dedicated venv** at the repo root so ACE-Step and CUDA PyTorch stay isolated from other Python projects:

1. From the **repository root**, run:

   ```powershell
   .\scripts\audio-pipeline\setup-audio-env.ps1
   ```

   This creates **`.venv-audio/`** (gitignored) and prints the exact follow-up steps.

2. Activate it before every batch session:

   ```powershell
   .\.venv-audio\Scripts\Activate.ps1
   ```

3. **Secrets / device**: copy **[`environment.audio.example.env`](environment.audio.example.env)** to **`scripts/audio-pipeline/environment.audio.local.env`** (gitignored), set **`HF_TOKEN`** if needed and adjust **`ACESTEP_DEVICE`** / optional **`ACESTEP_*`** vars. Load them into your shell before running `yarn audio:ace-step:*` (see comments in the example file).

4. Install **PyTorch (CUDA)** and **ACE-Step 1.5** inside this venv only — follow the URLs printed by the setup script and [Install ACE-Step 1.5](#install-ace-step-15-once-per-machine) below.

5. **`yarn audio:ace-step:*`** uses **[`run-ace-batch.mjs`](run-ace-batch.mjs)** — it prefers **`.venv-audio\Scripts\python.exe`** (or **`ACESTEP_PYTHON`**) automatically, so you **do not** need to activate the venv before Yarn unless you prefer to. Override with **`ACESTEP_PYTHON`** pointing at a full interpreter path if needed.

### One-shot machine bootstrap (Windows)

From the repo root:

```powershell
.\scripts\audio-pipeline\full-audio-setup.ps1
```

Runs **`setup-audio-env.ps1`**, **`install-acestep.ps1`**, then **`yarn audio:prep-ace-app`**. Checkpoint download remains manual — see **[ACE-Step INSTALL.md](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md)**.

### Weights in a sibling folder (HuggingFace-style repo)

If you cloned weights into something like `../Ace-Step1.5` next to this game (folders `acestep-v15-turbo/`, `acestep-5Hz-lm-1.7B/`, `Qwen3-Embedding-0.6B/`, `vae/` at that root), set **`ACESTEP_PROJECT_ROOT`** to that **absolute** path before `yarn audio:ace-step:*`. See [`environment.audio.example.env`](environment.audio.example.env).

Upstream expects **`ACESTEP_PROJECT_ROOT/checkpoints/acestep-v15-turbo/`**. If your snapshot is **flat** (turbo at the repo root), `batch_ace_step.py` creates **`checkpoints/`** and **directory junctions** into those folders on Windows (symlinks on macOS/Linux) on first run — no duplicate downloads. If junction creation fails, enable Windows Developer Mode or run the shell elevated once, or move the folders manually under `checkpoints/`.

### Unblocking the full ACE batch (references + `acestep`)

Two things used to stall runs:

| Blocker | Fix |
|--------|-----|
| Missing **`dist/assets/sounds/*.wav`** | Jobs use **`scripts/audio-pipeline/reference-audio/`**. Either run **`yarn audio:prep-ace-app`** (procedural stubs + **`yarn audio:materialize-references`**) or copy your **entire** legacy pack with **`yarn audio:materialize-references-from-pack -- --from path\to\sounds`** (optional **`--recursive`**). Then optionally **`yarn audio:apply-reference-coverage -- --write`** so each job’s `reference_audio` is the first file that exists from `referenceSourceCoverage`. See **Legacy sound pack** below. |
| **`No module named 'acestep'`** (wrong interpreter) | Yarn routes through **`run-ace-batch.mjs`**, which runs **`batch_ace_step.py`** with **`.venv-audio`** first (or **`ACESTEP_PYTHON`**). Install packages into that venv via **`install-acestep.ps1`** or **`full-audio-setup.ps1`**. Then download checkpoints per **[ACE-Step INSTALL](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INSTALL.md)**. |

Then: **`yarn audio:ace-step:app:dry`** (validates jobs; with **`acestep`** installed in **`.venv-audio`**, dry-run also validates **`GenerationParams`** keys) and **`yarn audio:ace-step:app`** for GPU renders into **`tmp/audio/ace-step/`**.

### Legacy sound pack (full folder)

Use this when you have a folder of **legacy-named** `*.wav` files (e.g. restored `dist/assets/sounds/`, same basenames as in [`jobs.memory-dungeon-app-audio.json`](jobs.memory-dungeon-app-audio.json) / `referenceSourceCoverage`).

1. **`yarn audio:materialize-references-from-pack -- --from <abs-or-rel-path>`** — copies every `*.wav` from the pack into **`reference-audio/`** (by basename). Add **`--recursive`** if the pack is nested. If `--from` is already **`reference-audio/`**, only **validates** that each job’s current `reference_audio` file exists. Set **`AUDIO_REFERENCE_PACK`** instead of `--from` if you prefer env.
2. Optional: **`yarn audio:apply-reference-coverage -- --write`** — for each of the 21 jobs, sets `reference_audio` to **`reference-audio/<first existing>`** from that job’s `referenceSourceCoverage` list (priority order). Dry-run (no `--write`) prints the plan.
3. **`yarn audio:ace-step:app:dry`** then GPU batch + **`yarn audio:install:ace-app-outputs`** as usual.

**Prep split:** **`yarn audio:prep-ace-app`** regenerates **procedural** WAVs into `src/renderer/assets/audio/**` before stub materialize — avoid it when those slots already hold finals you care about. For pack-driven references, use **materialize-from-pack** (and placeholders only to fill **missing** shipped files, if needed).

## Install ACE-Step 1.5 (once per machine)

Follow the official repo: clone or install the package so `import acestep` works (pip/uv from GitHub as documented there). Typical steps:

1. Create a venv with Python 3.11+.
2. Install PyTorch with **CUDA 12.8** from the PyTorch index (match [ACE-Step-1.5](https://github.com/ace-step/ACE-Step-1.5) `pyproject.toml`).
3. `pip install` / `uv sync` the **ACE-Step 1.5** project (not the older ACE-Step repo unless you know you need it).
4. Download checkpoints: use upstream’s `acestep-download` or first launch `acestep` Gradio once so weights land under the expected **checkpoints** directory (often next to the package or under the user cache—see upstream docs).

Set `HF_TOKEN` if Hugging Face gates any weights.

## Legal / rights

Use only **reference or source audio you have the right to use** (your stems, licensed packs, etc.). Generated output may still resemble commercial styles; clear rights and labeling are your responsibility.

See **[RIGHTS.md](RIGHTS.md)** for strategy (text-only vs licensed references vs clearance). **[EVENT_MAP.md](EVENT_MAP.md)** maps Memory Dungeon Web Audio events to procedural vs ACE-Step use. **[PROMPTS.md](PROMPTS.md)** lists rights-safe caption seeds. For CC-BY reference files in `samples/`, use **[samples/ATTRIBUTION.template.txt](samples/ATTRIBUTION.template.txt)**.

## Usage

From the **game repo root**:

```bash
yarn audio:ace-step:batch:dry
yarn audio:ace-step:smoke   # one short text2music job (~1 GPU minute after models load)
yarn audio:ace-step:batch
```

Or directly (same interpreter resolution as Yarn — prefers **`.venv-audio`**):

```bash
node scripts/audio-pipeline/run-ace-batch.mjs --dry-run --jobs scripts/audio-pipeline/jobs.example.json
node scripts/audio-pipeline/run-ace-batch.mjs --jobs scripts/audio-pipeline/jobs.example.json
```

Copy `jobs.example.json` to e.g. `tmp/my-jobs.json`, edit captions and paths, then pass `--jobs tmp/my-jobs.json`.

The bundled `jobs.example.json` includes three jobs: **01** runs with no extra files; **02** and **03** expect audio files under `scripts/audio-pipeline/samples/` (see `samples/README.md`). Remove or edit those jobs if you do not add files yet.

### Jobs file

JSON object with a `jobs` array. Each job **must** include `id`. Other fields map to ACE-Step `GenerationParams` (see upstream `docs/en/INFERENCE.md`). Unknown keys are rejected.

Paths `reference_audio` and `src_audio` are resolved relative to the **jobs file’s directory**, then relative to the repo root.

For **`cover`**, set `task_type`: `"cover"`, `src_audio` to your loop/file, `caption` to the target style, and optionally `audio_cover_strength` (e.g. `0.5`).

### Outputs

- Rendered files under `tmp/audio/ace-step/` (default; override with `--out-dir`).
- Manifest: `tmp/audio/ace-step/generated-ace-step-last-run.json` (top-level `variants`, `qualityPreset`, `inferenceStepsCli`, `qualityOverlay`, plus one row per **render**; `variant` is set when `--variants` > 1).

### Multi-variant (A/B) batch

`batch_ace_step.py` accepts **`--variants N`** (short **`-n`**, default `1`):

- `N` > 1: each job is rendered `N` times with distinct seeds. Outputs go under `tmp/audio/ace-step/<jobId>/v01/`, `v02/`, …, `vNN/`. Fixed JSON seeds use an offset of `7919` per take; “random” jobs use randomness for the first take and derived seeds for the rest.
- `N` == 1: same layout as before (`tmp/audio/ace-step/<jobId>/` with no `v##` subfolders).

Example (three takes per event): **`yarn audio:ace-step:app:variants`**, or:

```bash
node scripts/audio-pipeline/run-ace-batch.mjs --jobs scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json --variants 3
```

### Quality / step count

`batch_ace_step.py` can apply a small **default overlay** to every job (merged **under** the job: fields in the jobs JSON still win). This mainly raises **`inference_steps`** for the turbo model (higher = usually finer detail, slower GPU). See upstream [INFERENCE.md](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INFERENCE.md) for ranges.

- **`--quality balanced`**: `inference_steps=8` (typical default-style step count for turbo in docs).
- **`--quality high`**: `inference_steps=14`; if your installed `acestep` has `enable_normalization` on `GenerationParams`, it is set to `true` for a slightly more level output.
- **`--quality max`**: `inference_steps=18`; same optional normalization.
- **`--inference-steps N`**: if set, sets `inference_steps` in the overlay and **overrides** the step count from `--quality` (job-level `inference_steps` in JSON still wins over both).
- **Omit** `--quality` and `--inference-steps` for the previous behavior: no quality overlay, only whatever each job and upstream defaults set.

**Convenience:** `yarn audio:ace-step:app:high` runs the app batch with **`--quality high`**, `yarn audio:ace-step:app:max` with **`--quality max`**, and **`yarn audio:ace-step:app:hq-variants`** (or **`app:max-variants`**) combines quality with **`--variants 3`** for A/B listening.

### Full app sound replacement (all 29 shipped assets)

The Memory Dungeon app batch in [`jobs.memory-dungeon-app-audio.json`](jobs.memory-dungeon-app-audio.json) has **29** jobs; they map to the files installed by [`install-ace-app-outputs.mjs`](install-ace-app-outputs.mjs) into `src/renderer/assets/audio/sfx/`, `ui/`, and `music/`. This is the path to **replace every shipped non-procedural** cue and both music loops. Procedural fallbacks in `gameSfx.ts` / `uiSfx.ts` only play when a file is missing.

1. **Machine:** set up **`.venv-audio`**, ACE-Step, checkpoints, optional `ACESTEP_PROJECT_ROOT` (see [Prerequisites](#prerequisites) and [Install ACE-Step 1.5](#install-ace-step-15-once-per-machine)). Install **ffmpeg** on PATH (required for the install/trim step). In step 6, pass **`--loudness`** to the install command if you want ffmpeg **loudnorm** on the trimmed WAVs.
2. **References:** ensure `scripts/audio-pipeline/reference-audio/` is ready: **`yarn audio:prep-ace-app`** and/or **`yarn audio:materialize-references-from-pack`**, and optionally **`yarn audio:apply-reference-coverage -- --write`**. Renders must match right/timbre; rights are on you (see [RIGHTS.md](RIGHTS.md)).
3. **Validate:** `yarn audio:ace-step:app:dry` (and pass any flags you will use, e.g. `node ... -- --quality high` or use `yarn` scripts below).
4. **Generate (quality + A/B):** e.g. **`yarn audio:ace-step:app:hq-variants`** ( `--quality high` + three takes per job under `v01`/`v02`/`v03` ) or **`yarn audio:ace-step:app:max-variants`** for maximum step count. Slower and heavier on the GPU. Step counts and tradeoffs: [INFERENCE.md](https://github.com/ace-step/ACE-Step-1.5/blob/main/docs/en/INFERENCE.md).
5. **Choose takes:** listen under `tmp/audio/ace-step/<jobId>/v##/`. Pick one variant to install (or use default **`v01`** if a single best take per job).
6. **Install into the repo:** `yarn audio:install:ace-app-outputs -- --variant <n> --loudness` (omit `--variant` if you did not use `--variants` > 1; same variant index applies to all jobs). This overwrites the paths listed in the install map.
7. **Playtest** in the app (master volume, SFX, loop seams for menu/run), then **commit** the new WAVs (expect a large binary diff).

### ACE-Step 1.5 XL (4B DiT) — current production batch

Upstream shipped the **XL** DiT series in v0.1.6 (April 2026) and the **DCW** wavelet sampler correction in v0.1.7 (on by default). The 4B `acestep-v15-xl-turbo` checkpoint (8 steps, no CFG, ~20 GB on disk, ~12 GB VRAM in bf16) lives next to the 2B turbo weights under `cross-repo-libs/local-models/ace-step-1.5/checkpoints/`. Select it with `--config-path acestep-v15-xl-turbo` (or `ACESTEP_CONFIG_PATH`); the 1.7B LM stays the same.

```bash
yarn audio:ace-step:app:xl        # XL turbo, 8 steps, two takes per job (v01 / v02)
yarn audio:install:ace-app-outputs -- --variant 1 --loudness
```

Keep turbo checkpoints at **8** steps: the `--quality high|max` presets (14/18 steps) were tuned for the 2B model and do not improve the distilled XL sampler.

**Choosing takes without ears in the loop:** [`pick-ace-takes.py`](pick-ace-takes.py) scores every `v##` take per job (no clipping, early onset, energy in the first second for one-shots; even 1 s RMS windows for loops) and writes a picks JSON. `install-ace-app-outputs.mjs` accepts it with **`--picks tmp/audio/ace-picks.json`** (per-job override of `--variant`). Listen afterwards; the metrics only rule out obviously bad takes.

```powershell
.\.venv-audio\Scripts\python.exe scripts/audio-pipeline/pick-ace-takes.py --ace-out tmp/audio/ace-step --jobs scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json --out tmp/audio/ace-picks.json
yarn audio:install:ace-app-outputs -- --picks tmp/audio/ace-picks.json --loudness
```

**Gameplay run bed from the Ballance pack and the menu painting:** the captions carry the main-menu cathedral scene translated into sound language ([`MUSIC_SCENE_BRIEF.md`](MUSIC_SCENE_BRIEF.md)) while the reference audio carries the Ballance timbre. `src/renderer/assets/audio/dont_modify/` is the complete 40-file Ballance sound rip (rolls, hits, pieces, menu, misc, `Menu_atmo`, `Music_thunder`) that the legacy references always came from. The shipped `music/run-loop.wav` is an XL-turbo render guided by `reference_audio` blends of that pack rather than a text-only prompt: [`build-ambience-reference-mix.py`](build-ambience-reference-mix.py) chains level-matched excerpts into one WAV (`Ballance_music_mix.wav` from the eight musical/atmospheric files, `Ballance_all_mix.wav` from all forty; lists in `run-bed-references-ballance-*.txt`). [`jobs.run-bed-ambience.json`](jobs.run-bed-ambience.json) renders both candidates (`yarn audio:ace-step:run-bed`, three takes each), `pick-ace-takes.py` ranks them, and the winner is cut with `make-seamless-loop.py`. [`jobs.run-bed-library.json`](jobs.run-bed-library.json) (`yarn audio:ace-step:run-bed:library`) is the comparison set: the three vault beds alone and the curated freesound library next to the repo (`run-bed-references.txt`). The reference audio steers style only; none of the Ballance files ship as music (see [RIGHTS.md](RIGHTS.md)).

**Portfolio run bed:** `yarn audio:ace-step:ambience` renders [`jobs.portfolio-ambience.json`](jobs.portfolio-ambience.json) (three takes) into `tmp/audio/ace-step-ambience/`; pick one, run `make-seamless-loop.py` into `assets/audio/portfolio-feedback-pack/demo-ambience-loop.wav`, then `yarn audio:export-runtime-ogg`. `gameplayMusic.ts` plays `music/run-loop.ogg` in runs and uses that bed only as a fallback when the run loop is missing from a bundle.

**Loops:** text2music renders open cold and fade out, so `install-ace-app-outputs.mjs`'s plain `-t` trim leaves a seam. For `menu-loop`, `run-loop`, and the portfolio `demo-ambience-loop`, run [`make-seamless-loop.py`](make-seamless-loop.py) on the chosen take instead (the shipped `menu-loop` / `run-loop` are still the earlier 2B renders by choice; the XL takes remain under `tmp/audio/ace-step/`): it drops the intro/outro, equal-power crossfades the tail back over the head, and scales to a target RMS under a peak ceiling (`--target-rms-db -24 --peak-db -3` for the subtle run bed).

**Git worktrees:** the wrappers look for `cross-repo-libs` as a sibling of the repo root. From a worktree under `.claude/worktrees/`, set `CROSS_REPO_LIBS_ROOT=<path to cross-repo-libs>` (and `ACESTEP_PYTHON=<main checkout>\.venv-audio\Scripts\python.exe`, because the venv is gitignored and lives only in the main checkout). Reference WAVs are gitignored too — run `yarn audio:materialize-references` once per worktree.

## Yarn scripts

| Script | Purpose |
|--------|---------|
| `yarn audio:ace-step:batch` | Run batch (**`run-ace-batch.mjs`** prefers **`.venv-audio`**). |
| `yarn audio:ace-step:batch:dry` | Validate jobs + print paths; no GPU import. |
| `yarn audio:ace-step:smoke` | Single job [`jobs.smoke-one.json`](jobs.smoke-one.json); quick GPU path check. |
| `yarn audio:ace-step:app` | Run full Memory Dungeon app-audio batch (gameplay, UI, menu/run loops). |
| `yarn audio:ace-step:app:wav` | Same batch; `--audio-format wav` (skip FLAC round-trip). |
| `yarn audio:ace-step:app:high` | Same as `app` with **`--quality high`** (higher `inference_steps`, optional norm). |
| `yarn audio:ace-step:app:max` | Same as `app` with **`--quality max`** (highest shipped turbo step preset). |
| `yarn audio:ace-step:app:hq-variants` | **`--quality high`** + **`--variants 3`** (production A/B batch). |
| `yarn audio:ace-step:app:max-variants` | **`--quality max`** + **`--variants 3`**. |
| `yarn audio:ace-step:app:variants` | Same as `app` with **`--variants 3`** (A/B under each `v##/`). |
| `yarn audio:ace-step:app:dry` | Validate the full app-audio jobs file (no torch). |
| `yarn audio:install:ace-app-outputs` | Copy + trim renders into `assets/audio` (needs ffmpeg). |
| `yarn audio:materialize-references-from-pack` | Copy all `*.wav` from `--from` into `reference-audio/`; validate job refs. Pass **`-- --from dir`** [`--recursive`]. |
| `yarn audio:apply-reference-coverage` | Pick `reference_audio` from `referenceSourceCoverage` (first file present). **`-- --write`** to save jobs JSON. |

Interpreter override: set **`ACESTEP_PYTHON`** to an absolute path to **`python.exe`** / **`python`**.

Adjust **`run-ace-batch.mjs`** fallbacks only if your machine lacks **`py -3`** / **`python3`** on PATH.

### Ambient-only jobs (no sample files)

Text-only loops for menu/run beds (nothing in `samples/` required):

```bash
node scripts/audio-pipeline/run-ace-batch.mjs --dry-run --jobs scripts/audio-pipeline/jobs.game-ambient.example.json
```

Hybrid ambience jobs — optional beds to pair with the bundled procedural chill loop:

```bash
node scripts/audio-pipeline/run-ace-batch.mjs --dry-run --jobs scripts/audio-pipeline/jobs.hybrid-ambient.json
```

When a render is selected, trim it to a clean loop, export WAV, and replace or add files under [`src/renderer/assets/audio/music/`](../src/renderer/assets/audio/music/README.md) (see `gameplayMusic.ts` for how the menu/run loop is loaded).

### Gameplay one-shots (`jobs.sfx.example.json`)

Use [`jobs.sfx.example.json`](jobs.sfx.example.json) to batch captions for flip / match tiers / shuffle / powers / floor clear. ACE-Step outputs **long** clips — **trim** each render to a short cue in a DAW or `ffmpeg`, normalize, export **OGG**, then copy into [`src/renderer/assets/audio/sfx/`](../src/renderer/assets/audio/sfx/README.md) with filenames from [`manifest.json`](../src/renderer/assets/audio/sfx/manifest.json). Rebuild the app; missing files keep procedural `gameSfx` tones.

```bash
node scripts/audio-pipeline/run-ace-batch.mjs --dry-run --jobs scripts/audio-pipeline/jobs.sfx.example.json
```

### Full app audio (`jobs.memory-dungeon-app-audio.json`)

Use [`jobs.memory-dungeon-app-audio.json`](jobs.memory-dungeon-app-audio.json) for **29** shipped targets in one batch (gameplay SFX, UI, meta one-shots, and two background loops; see the install map in [`install-ace-app-outputs.mjs`](install-ace-app-outputs.mjs)). Reference WAVs live under **`reference-audio/`** — run **`yarn audio:prep-ace-app`** for procedural stubs, or replace with licensed originals (see [`reference-audio/README.md`](reference-audio/README.md)). The install script **trims** using job `duration`; for a full replacement workflow, see [Full app sound replacement](#full-app-sound-replacement-all-29-shipped-assets) above.

```bash
node scripts/audio-pipeline/run-ace-batch.mjs --dry-run --jobs scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json
```

After a successful batch, install trimmed WAVs into `src/renderer/assets/audio/**` (uses job `duration` as `-t`; requires **ffmpeg** on PATH):

```bash
yarn audio:install:ace-app-outputs
```

1. If you used **`--variants` > 1**, listen to takes under `tmp/audio/ace-step/<id>/v##/`, then install a specific take, for example:  
   `yarn audio:install:ace-app-outputs -- --variant 2`  
   (installs from **`v02`** for every job; accepts `2`, `02`, or `v02`). If you omit **`--variant`** and a job folder contains **more than one** `v##` subfolder, the install script defaults to **`v01`** and prints a one-time warning. Flat outputs (no `v##` folders) are unchanged.
2. Optional **EBU R128–style** loudness via ffmpeg’s `loudnorm` filter:  
   `yarn audio:install:ace-app-outputs -- --loudness`  
   (`--normalize` is an alias). Requires an ffmpeg build that includes `loudnorm`; the script fails fast on startup if the filter is missing.

Dry-run install: `node scripts/audio-pipeline/install-ace-app-outputs.mjs --dry-run`. Override ACE output dir: `--ace-out path/to/ace-step`.
