# Music scene brief — what the loops have to fit

ACE-Step takes text and reference audio, not pictures, so the shipped shell art is translated here
into words and folded into the loop captions. Two inputs define the sound:

1. **The main-menu painting** (`src/renderer/assets/ui/backgrounds/bg-main-menu-cathedral-v1.png`,
   also the Game Over backdrop) — the *space* the music lives in.
2. **The Ballance sound pack** (`src/renderer/assets/audio/dont_modify/`, blended by
   [`build-ambience-reference-mix.py`](build-ambience-reference-mix.py)) — the *timbre* it borrows,
   passed as `reference_audio`.

Keep both when editing `jobs.run-bed-ambience.json` or the `menu-loop` / `run-loop` captions in
`jobs.memory-dungeon-app-audio.json`. Regenerate this brief if the menu painting changes.

## 1. The picture, read for sound

The menu background is the nave of a vast gothic cathedral at night, seen straight down the aisle:

- **Scale and depth.** Tier upon tier of pointed arches recede toward a far, almost black doorway.
  Everything is stone. The space is enormous and empty. → Long, soft **stone reverb**; a very low,
  steady **sub-drone** for the depth; nothing close-miked or dry.
- **Two temperatures of light.** Cold indigo and cyan fill the vault; thin **cyan wisps of arcane
  light** drift up the great arch and shed a few sparks. Against that, small **warm candle flames**
  burn on iron candelabras and behind wrought-iron gates on both sides of the aisle. → A cold,
  glassy, high **shimmer** (bowed glass, faint bell overtones) over a **warm, quiet low register**
  (soft pad or muted organ-like sustain) — never the other way round.
- **Motion.** Nothing moves except the drifting motes and the flicker of flames. → Music that
  **breathes rather than plays**: slow swells on the scale of a breath, a barely-there pulse, no
  drums, no arpeggio, no melody that asks for attention.
- **Mood.** Hushed, reverent, a little uncanny, but *safe*: this is a place to think, not a
  haunted house. → Minor-leaning but not dissonant; tension comes from stillness and distance,
  not from stingers or horror textures.
- **Material palette matches the game UI.** Aged gold, cold stone, cyan glass. → Metallic warmth in
  the low end, glass in the highs, no plastic synth leads, no orchestral brass.

## 2. What the Ballance pack contributes

The reference blends carry the *textures* of a marble-run puzzle world that this game descends
from: the cold `Menu_atmo` room tone, `Music_thunder`'s distant rolling weather, the `Ventilator`
hum and `UFO` drone, checkpoint chimes, and (in `Ballance_all_mix`) the wood, stone and paper
rolls and ticks. `audio_cover_strength` 0.5 lets that timbre through without cloning any track.

## 3. Compact caption block (paste into `caption`)

> vast empty gothic cathedral nave at night, tiers of stone arches receding into indigo dark,
> long stone reverb and a deep quiet sub-drone, cold cyan glass shimmer drifting high above warm
> candlelit low sustain, music that breathes rather than plays, slow swells, barely-there pulse,
> hushed and reverent not horror, aged gold cold stone and cyan glass, no drums, no melody

## 4. Menu vs run

- **Menu (`menu-loop`)**: the picture as-is — the hall at rest. Slower, emptier, more reverb.
- **Run (`run-loop`)**: the same hall with a game in progress on the stone floor — keep the space and
  palette, add a soft slow pulse and the Ballance textures (thunder undertow, hum, faint rolls) so
  there is quiet forward motion; still no drums or hook.
