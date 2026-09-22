# Card pipeline: the plates, the panels, and the light that answers a streak

A card is three pieces of art and one rule.

| Piece | Where it comes from | Where it lands |
| --- | --- | --- |
| The **face plate** — gold frame, blue gems, a stone well for the illustration | `front-face.png` (painted) → `front-face.webp` | `tileTextures` key `cardFace` |
| The **back plate** — gold labyrinth over dungeon arches | `reference-back.png` (painted) → `card-back-painted.webp` | `tileTextures` key `cardReference` |
| The **illustration** — 80 painted panels, one per pair | `batch_local_face_panels.py` → `cards/illustrations/face-panel-*.webp` | `getTileFaceOverlayTexture`, per tile |
| The **light** — the same paintings' glow, keyed out | `cut_card_back_glow.py` | `cardBackGlow`, `cardBackSpin`, `cardFaceGlow` |

The rule is [`tileBoardCardHeat.ts`](../../src/renderer/components/tileBoardCardHeat.ts), and what a card
shows on a given frame is [`cardGlowFrame.ts`](../../src/renderer/components/cardGlowFrame.ts).

## Regenerating the light

The glow layers are keyed out of the painted plates by hue, so nothing is erased from the art and
the game composites `plate + glow × heat(t)` — the same trick the room's backdrops use
(`scripts/scene-pipeline/`).

```bash
# The back: rune light over the whole plate, and the labyrinth medallion as a disc the game turns.
py -3.12 scripts/card-pipeline/cut_card_back_glow.py \
    src/renderer/assets/textures/cards/reference-back.png <build dir> \
    --prefix card-back --disc 0.5 0.487 0.315

# The face: the gems set around its frame.
py -3.12 scripts/card-pipeline/cut_card_back_glow.py \
    src/renderer/assets/textures/cards/front-face.png <build dir> --prefix card-face
```

Then encode to WebP beside the plates (`ffmpeg -c:v libwebp -quality 82`) as
`card-back-glow-runes.webp`, `card-back-spin.webp` and `card-face-glow.webp`. `check-sheet.png` in
the build dir shows plate | plate + runes | plate + runes + gold, which is the ladder the chain
climbs.

**The disc radius is typed twice on purpose and must not drift.** `--disc … 0.315` crops the
medallion at that fraction of the plate's shorter side, and `CARD_BACK_SPIN_DISC_RADIUS_FRACTION`
in `TileBezel.tsx` sizes the plane it turns on. Change one without the other and the turning light
slides off the painted labyrinth, which looks like a rendering bug and is not one.

## What the light does

Everything reads the chain meter's fill (`runChainMeter(run).fill`), plumbed to the board as
`cardHeat`:

- **rune and gem glow** rises early and steeply, so the first pair of a chain already changes the
  board;
- **the medallion** is still until a chain is real, then accelerates all the way to Fever;
- **a landed pair** flares, bigger the further the chain has come;
- **a lost chain** gutters — the light snuffed below resting for about a tenth of a second, then
  back. The break is read from `heat` falling rather than passed in as an event: the meter only
  empties on a mismatch;
- **reaching Fever** throws a flourish across every card at once, on the rising edge only.

Under **reduce motion** a card's light is a pure function of the chain: no breath, no turning, and
none of the transients, because they are all sudden changes in brightness. The chain stays legible
because the light *level* is what carries it.

The per-frame drive is gated on `getSceneEffectTier` — a lean device keeps the light and loses the
motion — and a card whose side is facing away does no per-frame work at all.

## Generating new art

`batch_local_zimage.py` and the manifests here drive Z-Image-Turbo on the local GPU; see
`docs/` and the manifests' own comments. **Check `yarn audit:renderer-assets` before generating
anything**: it reports art that is only ever *mentioned* in comments and docs, which is how three
finished pieces in this repo shipped unseen while the code loaded placeholders.
