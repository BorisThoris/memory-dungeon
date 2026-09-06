# Reference audio — rights strategy for this repo

Pick **one** primary workflow. Do not use copyrighted commercial game rips as references unless you have a written license.

## Current state of this repo (read first)

`src/renderer/assets/audio/dont_modify/` is the complete 40-file **Ballance** (Atari / Cyparade, 2004) sound rip. It has been the `reference_audio` timbre anchor for every shipped cue since the first ACE batch, and the gameplay run bed (`jobs.run-bed-ambience.json`) is steered by blends of it at `audio_cover_strength` 0.5. That is workflow **C** below: the files never ship as game audio and the renders are new material, but the project owner has to hold or obtain clearance for a commercial (Steam) release, or switch the run bed and cue jobs to workflow **A**/**B** references before release.

## A. Text-only ACE-Step (default for style exploration)

- Use [`batch_ace_step.py`](batch_ace_step.py) with `task_type: "text2music"` and **captions only**—no `reference_audio` / `src_audio`.
- Lowest rights risk for references; output is still AI-generated—verify originality and disclosure policies for your ship channel.
- Prompt ideas: [`PROMPTS.md`](PROMPTS.md).

## B. Licensed or permissioned reference audio

1. Sources you may use: **your recordings**, **royalty-free packs** with a license matching your distribution (Steam/commercial), **CC0**, or **CC-BY** (keep attribution—use [`samples/ATTRIBUTION.template.txt`](samples/ATTRIBUTION.template.txt)).
2. Place short WAVs under [`samples/`](samples/) (or another folder you document).
3. In jobs JSON, use `reference_audio` with **low** `audio_cover_strength` (about 0.2–0.4) for gentle style steering, not cloning a whole track.

## C. Commercial “sound-alike” to an existing published game

- **No** unofficial bulk downloads from the internet as a substitute for clearance.
- If you need identifiable similarity to a specific title’s soundtrack: obtain **permission or license** from rights holders first; repo tooling cannot replace legal clearance.
