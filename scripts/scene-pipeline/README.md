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
python3 scripts/scene-pipeline/bake_ambient.py   # the ambient atlas and fog tile every scene shares
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

Every scene sits in a *plate* (`scenePlate.module.css`): a box with the painting's aspect ratio,
cover-fitted to the scene, so a sprite at 30 % of the plate is on its torch at any viewport. The
plate drifts slowly (a 48 s push in and back) and turns toward the pointer (`useSceneLook`), the
things in the room a little more than the walls.

**A scene is one canvas.** In the plate is a single `<canvas>` the size the art was painted at
(1376 x 768), stretched over the plate by CSS (`SceneCanvas.tsx`). Each scene has a pure function
from its props and a clock to a list of draws (`composeGameplayScene`, `composeCathedralScene`,
`composePortalScene`; the types are in `scenePaint.ts`), and `paintScene` puts that list on the
canvas: the base, each light added to it (`lighter`) at the strength the run sets, the flames as
flipbook frames on their own clocks (`sceneSpriteClocks`: periods spread ±10 %, starts
staggered; drawn source-over, because a flame is opaque paint and adding it to the yellow-white
wall clips to a pale ghost), then everything that drifts.

It used to be an element per layer, blended by the browser (`mix-blend-mode: plus-lighter`), up
to twenty of them in the dungeon with a filter and a mask above. Each blended element is an
offscreen surface the size of the screen in device pixels, re-composited whenever anything under
it moves: 33 MB apiece at 4K, 12 MB apiece on a phone at three pixels to the point. The stack
that fit a laptop did not fit either, and when the compositor ran out of room it dropped tiles,
which is the flashing that was reported at high resolutions and on phones. One canvas at the
art's size is 4 MB on every device. The rule that follows: **nothing in a scene is its own
element unless it has to be** (the storm's bolts, the gold rain and the black hole still are).

Images are decoded once and held (`sceneBitmaps.ts`), taken from the run preloader's own
elements where it has them, so a scene never draws a frame it has to wait for; a colour grade
that follows the run (the ring turning rose) is applied by the canvas as it draws, and a blur
(the snow's glow) is baked into a copy once. Time is `sceneClock.ts`: what a CSS transition did
is `smooth`, what remounting an element to restart its animation did is `since`, and a loop
whose rate changes is `phase`.

The base sinks to the shell's 42 %; the light does not. Intensities: the ring follows the
chain meter's *fill* continuously (`gameplaySceneLevels.ts`: light, glow, hue toward rose,
saturation and the break-flash peak all ease up from chain 0 to Fever), breathes during memorize,
and its floor light flashes on a break (remounted per event so two breaks in a row both flash);
the torches always burn, their flames as sprites over painted light that holds still, and burn harder the better the run is going — the chain drives each flipbook's rate, how
far each flame climbs its own torch and how thickly its sparks come off (`sceneFlameLevels`), on a
curve steep off zero so the first pair of a chain already shows in the fire, against the ring's
ease-in; the painted torchlight on the stone does *not* move with the chain, because light a
painter threw across a wall cannot honestly grow and holding it still is what lets the flames
read. When the next pair would land a rung (`chainRungApproach(...).imminent`) the fire **draws
breath** — pulled in, tighter, fewer sparks, the inverse of the climb so the rung landing releases
it rather than adding to it. That is the only thing in the room that looks forward instead of
reporting, and it leans at the same moment the HUD ladder lights the rung ahead, so the
anticipation is not one lit label in a corner. They flare with a break as well (the pop barely, Fever up the
wall: `sceneTorchFlarePeak`); a cleared floor is the room exhaling (the ring swells and settles,
the torches gutter and recover); the ring throws up motes as the chain climbs; mist drifts in the
corridor. `CathedralScene.tsx` (main menu,
game over) wavers the candlelight (continuously: it used to step, and a stepped change of a whole
bright layer is a flash), breathes and drifts the wisps, climbs the arch with motes
and plays the 29 candle flames; at the run's end (`mood="ended"`) the candlelight sinks and the
spirit-light takes the nave; its parent sinks the base further than the lights (`--scene-base-opacity`,
`--scene-light-opacity`). The game-over nave also takes `heat` — the best chain the finished run
actually reached, put through `chainMeter` so it lands on the same scale the board used during
play — so the candles go on burning at the rate the run earned while the room goes dark around
them. A run that never chained ends on guttering candles. The menu passes nothing, because a
player who has not pressed Play has no run for the room to report on. `PortalScene.tsx` (Choose Your Path, when the recommended run's poster
is the Classic clearing) breathes the runes, pulses the moon, twinkles the stars on two curves
that never agree, spins the vortex disc in the arch (its feathered rim dissolving into the painted outer
arms, a fainter copy turning the other way), drifts mist over the ground and floats motes through
the trees.

### What lives in the rooms

Beyond what the painter painted, each scene has things in it that move and things that happen
now and then, all drawn from one baked atlas (`bake_ambient.py` → `ambient-v1.webp`, 512 px: glow
dots in each light's colour, a glint, dust, a drop and its ripple, smoke, leaves, a bat and a
moth as flipbooks, a spider, a falling star, a sheet of light shafts) and one fog tile that
repeats (`ambient-fog-v1.webp`). `sceneAmbient.ts` places them:

- **Cathedral**: moonlight in shafts from the clerestory with dust turning in it, mist on the
  floor of the far nave, a pool of light at each stand, glints along the spirit-light, a moth
  round each near stand; a draught crosses every half minute and the flames lean and duck as it
  passes; a candle gutters, smokes and catches again; a bat crosses the vault. On the menu the
  candles burn up while Play has the pointer or the focus (`stirred`).
- **Dungeon**: mist in the corridor and low over the floor, dust in the torchlight, smoke and a
  wavering pool of light at the two big torches, glints round the ring that quicken with the
  chain, water dripping off the vault and ringing on the floor; a bat in the far passage, eyes
  in the dark that blink and go, a spider down its thread and back.
- **Portal clearing**: sparks spiralling into the vortex, single stars catching, fireflies
  among the glowing plants, leaves coming down off the canopy, spores adrift; a falling star.

Things that happen now and then are `sceneOccurrence`: a function of the time alone, so nothing
has to remember that an event is under way. To add one, bake its cell, give it a helper or use
`crossingDraws` / `glintDraws` / `driftDraws`, and call it from the scene's compose function.
Keep events rare, small, dim and at the edges: a thing that starts moving takes the eye in a way
a thing that is always moving does not, and the board or the menu is in front of it.

What a device gets is `getSceneEffectTier` (`src/shared/graphicsQuality.ts`), fed the pointer
kind and the viewport by `useSceneEffectTier`. Every tier draws the same room, because one
canvas costs the same everywhere: **full** on a desktop of any resolution, at thirty frames a
second with the plate drifting and turning; **lean** on any coarse-pointer device, any viewport
under 900 px, or at `low`: twenty-four frames a second, about half the specks, the plate held
still; **still** under reduce motion: the lit painting, every flame on its first frame, no
flash. (Lean used to drop the light passes, the mist and the motes, and 4K was held to lean,
both to keep the layer count down; neither is needed now.) A scene with no run behind it (the
menu's candles, the portal) burns as the painter painted it.

## Extending

- Another flame (a brazier): add its box to `sprites/<plate>.json` and rerun; the manifest and
  `SCENE_SPRITES` pick it up, nothing in the components changes.
- Another element that should react (a window): add its hue key or a hand window in the
  segmenter, a light in `blender_scene_lights.py` with its own light group, and a draw for it in
  the scene's compose function. A new layer is one more `drawImage` a frame, not a new element.
- Another scene that should feel the run: give its compose function the heat and pass
  `sceneFlameLevels`' rate and lift to `flameDraws`, as the cathedral does. Leave it off and the
  scene keeps the flame it was painted with.
- Something new adrift or passing through: see "What lives in the rooms" above.
- Another backdrop (the arcane workshop): measure its flames, run `scene.sh <plate> <prefix>
  <boxes.json>` (or `cathedral.sh` when no light pass is wanted); the positions in `SCENE` are per
  plate and need re-measuring.
