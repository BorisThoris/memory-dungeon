# Scene pipeline: painted backdrops as places

`bg-gameplay-dungeon-ring-v1.png` and `bg-main-menu-cathedral-v1.png` are paintings with their
light baked in. This pipeline cuts the flames out of them as animated sprites, splits the rest
into a dark base and additive light layers (and, for the dungeon, renders how each light in the
room falls on the geometry), and the game (`GameplayScene`, `CathedralScene`) composites
`base + Σ layer × intensity(t)` with the sprites playing over it, so the rune ring, the floor it
lights, the torches and the candles move and react.

```bash
bash scripts/scene-pipeline/scene.sh        # dungeon: cut sprites → segment → Blender passes → assets
bash scripts/scene-pipeline/cathedral.sh    # cathedral: cut sprites → segment → assets
bash scripts/scene-pipeline/portal.sh       # portal clearing (Classic poster): cut the vortex disc → segment → assets
```

## Stages

0. **`cut_sprites.py`** — lifts each flame off the wall inside a hand-measured box
   (`sprites/<plate>.json`; colour keys cannot do it, the stone a torch lights is the same
   yellow-white as the flame's core), dims the painted flame in the plate to its ember core, and
   warps the cut-out into a loopable flipbook strip: the root stays nailed to the cup or wick, the
   body sways on three incommensurate clocks, a scrolling noise carves the silhouette into licks
   and lets the tip break, the whole thing breathes in brightness. Writes the dimmed plate (which
   the segmenter takes), one RGBA strip per flame and `<prefix>-sprites.json` with each box as
   fractions of the plate. `sprites-sheet.png` and `still-vs-rebuilt.png` are for a look before
   installing. `find_candles.py` drafts the boxes for candles (small flames on a dark room);
   torches are measured by eye on a gridded crop. **`cut_disc.py`** cuts a feathered disc
   (the portal's vortex) the scene spins in place, in the same manifest shape.
1. **`segment_scene.py`** — keys the emissive families out of the painting by hue (violet ring on
   the floor, orange flames and the painted torchlight near them, blue wall glyphs) into RGBA
   layers, and leaves a base with that light removed: bare stone under the ring, torch-lit walls
   dimmed by what the torch layer puts back. Writes `scene.json` with the ring ellipse, torch and
   rune positions (fractions of the plate). `check-sheet.png`: base | base + all layers at 1 (≈ the
   painting) | layers alone. **`segment_cathedral.py`** does the same for the nave with two
   families: the candlelight on the stone and the teal wisps; **`segment_portal.py`** for the
   clearing with three: the runes and glowing plants, the moon, the stars.
2. **`blender_scene_lights.py`** (Blender 4.3, Cycles, GPU) — a plain room whose proportions are
   solved from the painting (level camera, 75° FOV; the ring's ellipse fixes the depth scale, the
   wall bases the width; corners chamfered so the shading has no hard seams), with the *base*
   camera-projected onto it as albedo plus bump. Point lights stand where the painting shows the
   ring and the six torches; each family is a Cycles **light group**, so the render gives one
   image per family of *painting × that light* — the slabs catching the ring in perspective, the
   torches raking the walls. Standard view transform, so the additive maths holds.
3. **Export** — PNG masters + WebP (quality 84, alpha kept) into `src/renderer/assets/ui/backgrounds/`
   as `bg-gameplay-dungeon-ring-v2-{base,glow-ring,glow-torches,glow-runes,light-ring,light-torches-l,light-torches-r}`
   (the cathedral: `bg-main-menu-cathedral-v2-{base,glow-candles,glow-wisps}`; the portal:
   `bg-mode-classic-v2-{base,glow-runes,glow-moon,stars}`), and the sprite
   strips + manifest into `src/renderer/assets/ui/sprites/` (`assets/ui/sprites/index.ts` resolves
   them; `SCENE_SPRITES`).

## In the game

Both scenes sit in a *plate* (`scenePlate.module.css`): a box with the painting's aspect ratio,
cover-fitted to the scene, so a sprite at 30 % of the plate is on its torch at any viewport. The
plate drifts slowly (a 48 s push in and back) and turns toward the pointer (`useSceneLook`), the
sprites a little more than the walls. `SceneSprites` plays each strip with a stepped CSS
animation on its own clock (`sceneSpriteClocks`: periods spread ±10 %, starts staggered), drawn
source-over (a flame is opaque paint; adding it to the yellow-white wall clips to a pale ghost),
with sparks rising off the torches.

`GameplayScene.tsx` stacks the layers with `mix-blend-mode: plus-lighter` inside an isolated
group. The base sinks to the shell's 42 %; the light does not. Intensities: the ring follows the
chain meter's *fill* continuously (`gameplaySceneLevels.ts`: light, glow, hue toward rose,
saturation and the break-flash peak all ease up from chain 0 to Fever), breathes during memorize,
and its floor light flashes on a break (remounted per event so two breaks in a row both flash);
the torches always burn, their flames as sprites and their painted light flickering on two stepped
clocks, whatever the run is doing; mist drifts in the corridor. `CathedralScene.tsx` (main menu,
game over) flickers the candlelight, breathes and drifts the wisps, and plays the 29 candle
flames; its parent sinks the base further than the lights (`--scene-base-opacity`,
`--scene-light-opacity`). `PortalScene.tsx` (Choose Your Path, when the recommended run's poster
is the Classic clearing) breathes the runes, pulses the moon, twinkles the stars on two stepped
clocks, spins the vortex disc in the arch (its feathered rim dissolving into the painted outer
arms, a fainter copy turning the other way), drifts mist over the ground and floats motes through
the trees.

What a device gets is `getSceneEffectTier` (`src/shared/graphicsQuality.ts`), fed the pointer
kind and the viewport by `useSceneEffectTier`: **full** on a desktop at medium or high; **lean**
on any coarse-pointer device, any viewport under 900 px, or at `low`: the glow layers held still
and unpromoted (so they rasterize with the page and blend once, instead of one full-screen GPU
composite per layer per frame), the flame sprites and the vortex playing, no light passes, mist,
sparks, motes, echo, drift or parallax; **still** under reduce motion. On a throttled Pixel 5
emulation the full menu scene halved the frame rate (134 → 65 fps); lean costs nothing
measurable (143 → 139). Mist uses soft gradient stops, never `filter: blur()`, which re-filters
a moving layer every frame.

## Extending

- Another flame (a brazier): add its box to `sprites/<plate>.json` and rerun; the manifest and
  `SCENE_SPRITES` pick it up, nothing in the components changes.
- Another element that should react (a window): add its hue key or a hand window in the
  segmenter, a light in `blender_scene_lights.py` with its own light group, a layer and a CSS
  variable in the scene component.
- Another backdrop (the arcane workshop): measure its flames, run `scene.sh <plate> <prefix>
  <boxes.json>` (or `cathedral.sh` when no light pass is wanted); the positions in `SCENE` are per
  plate and need re-measuring.
