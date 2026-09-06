# ACE-Step caption seeds (text-only, rights-safe)

These are **starting points** for `task_type: "text2music"` with `"lyrics": "[Instrumental]"` and `"instrumental": true`. Tune duration/BPM per job JSON; keep `inference_steps` / `shift` aligned with upstream turbo defaults unless you switch models.

Copy lines into your jobs file `caption` field. Do not paste copyrighted lyrics or transcribed themes from commercial games.

## Full app batch (`jobs.memory-dungeon-app-audio.json`)

Authoritative **captions for all 21 shipped targets** (gameplay, UI, menu/run loops) live in [`jobs.memory-dungeon-app-audio.json`](jobs.memory-dungeon-app-audio.json). Each `caption` pairs with that job’s **`reference_audio`** for timbre.

**Scene brief from the shell art:** [`MUSIC_SCENE_BRIEF.md`](MUSIC_SCENE_BRIEF.md) turns the main-menu cathedral painting into caption language (space, light, motion, palette) and pairs it with the Ballance reference blends; use its compact caption block for any loop.

**Memory Dungeon style brief** (repeated in those captions):

- Setting: dark fantasy **memory-vault / shrine** of recalled pairs, **arcade-tight**, **crystalline** or **marble-glass** textures, **restrained** mix.
- Avoid: horror, dubstep/EDM drops, obvious drum loops, **vocals**, long lead melodies.
- One-shots: **single transient**, fast perceived attack, **no rhythmic pulse**, align with reference density; trim renders after batch.
- Loops (`menu-loop`, `run-loop`): **seamless loopable** beds, low motion, no hook melody.

## Menu / hub

- Calm puzzle lobby, soft synthetic pads, subtle marble-like glass touches, sparse percussion, loopable 60–90s, minor key
- Elegant dark fantasy UI bed, airy choir pad low in mix, no drums, seamless loop

## Run / board tension

- Low tension puzzle underscore, muted arpeggio, cold reverb, no drums, loopable 45s
- Suspenseful but not horror—crystalline textures, slow pulse 72 BPM

## Positive resolve (optional sting vs procedural SFX)

- Short bright confirmation sting, pentatonic bell cluster 1.5s, magical game reward (use only if replacing procedural match with a sample)

## Mismatch / penalty feel (optional)

- Soft disappointing cadence, two-note downward fifth, very short, non-destructive (usually procedural mismatch is enough)

## Shuffle / motion (only if designing a musical layer over shuffle FX)

- Quick mechanical sweep, filtered noise rise 0.3s—often better left to `gameSfx` procedural layers

## One-shot gameplay SFX (`jobs.sfx.example.json`)

ACE-Step outputs multi-second renders—**trim** to tight one-shots before exporting OGG into `src/renderer/assets/audio/sfx/`. Align captions with filenames in [`jobs.sfx.example.json`](jobs.sfx.example.json):

| Job id prefix | Intended sound |
|---------------|----------------|
| sfx-flip | Tile flip tick |
| sfx-gambit-commit | Gambit third-card commit |
| sfx-match-tier-low / mid / high | Match resolve by streak tier |
| sfx-mismatch | Wrong pair |
| sfx-power-arm | Power armed |
| sfx-destroy-pair | Destroy resolve |
| sfx-peek-power | Peek used |
| sfx-stray-power | Stray removed |
| sfx-shuffle-full | Full shuffle motion |
| sfx-shuffle-quick | Reduce-motion shuffle tick |
| sfx-floor-clear | Floor cleared sting |
