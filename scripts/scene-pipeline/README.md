# Scene pipeline: the gameplay backdrop as a relightable room

`bg-gameplay-dungeon-ring-v1.png` is a painting with its light baked in. This pipeline splits it
into a dark base and additive light layers, renders how each light in the room falls on the
geometry, and the game (`GameplayScene`) composites `base + Σ layer × intensity(t)` so the rune
ring, the floor it lights and the torches react to play.

```bash
bash scripts/scene-pipeline/scene.sh        # segment → Blender passes → PNG masters + WebP into assets
```

## Stages

1. **`segment_scene.py`** — keys the emissive families out of the painting by hue (violet ring on
   the floor, orange flames and the painted torchlight near them, blue wall glyphs) into RGBA
   layers, and leaves a base with that light removed: bare stone under the ring, torch-lit walls
   dimmed by what the torch layer puts back. Writes `scene.json` with the ring ellipse, torch and
   rune positions (fractions of the plate). `check-sheet.png`: base | base + all layers at 1 (≈ the
   painting) | layers alone.
2. **`blender_scene_lights.py`** (Blender 4.3, Cycles, GPU) — a plain room whose proportions are
   solved from the painting (level camera, 75° FOV; the ring's ellipse fixes the depth scale, the
   wall bases the width; corners chamfered so the shading has no hard seams), with the *base*
   camera-projected onto it as albedo plus bump. Point lights stand where the painting shows the
   ring and the six torches; each family is a Cycles **light group**, so the render gives one
   image per family of *painting × that light* — the slabs catching the ring in perspective, the
   torches raking the walls. Standard view transform, so the additive maths holds.
3. **Export** — PNG masters + WebP (quality 84, alpha kept) into `src/renderer/assets/ui/backgrounds/`
   as `bg-gameplay-dungeon-ring-v2-{base,glow-ring,glow-torches,glow-runes,light-ring,light-torches-l,light-torches-r}`.

## In the game

`src/renderer/components/GameplayScene.tsx` stacks the layers with `mix-blend-mode: plus-lighter`
inside an isolated group. The base sinks to the shell's 42 %; the light does not. Intensities:
the ring follows the chain meter's *fill* continuously (`gameplaySceneLevels.ts`: light, glow,
hue toward rose, saturation and the break-flash peak all ease up from chain 0 to Fever), breathes
during memorize, and its floor light flashes on a break (remounted per event so two breaks in a
row both flash); the torches always burn, flickering on two stepped clocks, whatever the run is
doing. Reduce motion freezes everything; `low` quality drops the three light passes.

## Extending

- Another element that should react (a brazier, a window): add its hue key or a hand window in
  `segment_scene.py`, a light in `blender_scene_lights.py` with its own light group, a layer and a
  CSS variable in `GameplayScene`.
- Another backdrop (the arcane workshop): run `scene.sh <plate> <prefix>`; the positions in
  `SCENE` are per plate and need re-measuring.
