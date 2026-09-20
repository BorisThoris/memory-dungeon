"""Split the painted gameplay backdrop into relightable layers.

The painting (`bg-gameplay-dungeon-ring-v1.png`) has its light baked in: the rune ring, the six
torches and the wall runes all glow at one fixed level. This keys those emissive families out by
hue into their own additive RGBA layers and leaves a *base* with the glow removed, so the game can
composite `base + sum(layer_i * intensity_i(t))` and drive each family from play.

    py -3.12 scripts/scene-pipeline/segment_scene.py <plate.png> <out dir> [--prefix bg-gameplay-dungeon-ring-v2]

Writes (all the plate's size):
    <prefix>-base.png          RGB, the room with the glow removed (what "no light" looks like)
    <prefix>-glow-ring.png     RGBA, the rune ring's own light (additive)
    <prefix>-glow-torches.png  RGBA, the flames and the painted torchlight on the stone (additive)
    <prefix>-glow-runes.png    RGBA, the blue wall glyphs (additive)
    <prefix>-mask-floor.png    L, the floor (for effects that must not climb the walls)
    scene.json                 the ring ellipse, torch and rune positions the Blender pass uses
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--prefix', default='bg-gameplay-dungeon-ring-v2')
args = ap.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

src = Image.open(args.plate).convert('RGB')
im = np.asarray(src).astype(np.float32) / 255
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
sat = d / (mx + 1e-6)
val = mx
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# ------------------------------------------------------------------ the scene as measured
# The ring is a circle on the floor; its image is this ellipse. Torches and rune panels are placed
# by eye on the 1376x768 plate; all positions are fractions so other sizes of the plate work too.
SCENE = {
    'plate': [W, H],
    'horizon_y': 0.50,
    'ring': {'cx': 0.500, 'cy': 0.729, 'rx': 0.218, 'ry': 0.104},
    'torches': [
        {'x': 0.112, 'y': 0.290, 'side': 'left', 'depth': 'near'},
        {'x': 0.322, 'y': 0.360, 'side': 'left', 'depth': 'mid'},
        {'x': 0.513, 'y': 0.393, 'side': 'left', 'depth': 'far'},
        {'x': 0.905, 'y': 0.300, 'side': 'right', 'depth': 'near'},
        {'x': 0.755, 'y': 0.350, 'side': 'right', 'depth': 'mid'},
        {'x': 0.672, 'y': 0.405, 'side': 'right', 'depth': 'far'}
    ],
    'rune_panels': [
        {'x0': 0.360, 'y0': 0.245, 'x1': 0.410, 'y1': 0.345},
        {'x0': 0.800, 'y0': 0.140, 'x1': 0.880, 'y1': 0.250},
        {'x0': 0.835, 'y0': 0.290, 'x1': 0.905, 'y1': 0.400}
    ]
}
ring = SCENE['ring']
ell = ((xx / W - ring['cx']) / (ring['rx'] * 1.25)) ** 2 + ((yy / H - ring['cy']) / (ring['ry'] * 1.3)) ** 2


def soften(mask, radius):
    m = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(m).astype(np.float32) / 255


def window(x0, y0, x1, y1):
    return (xx / W >= x0) & (xx / W <= x1) & (yy / H >= y0) & (yy / H <= y1)


# ------------------------------------------------------------------ masks
# Rune ring: violet inside the floor ellipse. The glyphs are thin, so the soft mask is grown a
# little to keep their halo.
violet = (hue > 0.60) & (hue < 0.82) & (sat > 0.22) & (val > 0.32) & (ell < 1)
ring_soft = np.clip(soften(violet.astype(np.float32), 2.5) * 1.6, 0, 1)

# Torches: the flame cores (bright orange) plus the painted torchlight on the nearby stone
# (warm, saturated). Kept as one layer so a flicker moves the light with the flame.
flame = (hue > 0.03) & (hue < 0.14) & (sat > 0.45) & (val > 0.80)
warm = (hue > 0.02) & (hue < 0.13) & (sat > 0.45) & (val > 0.50) & (yy / H < 0.62)
near_torch = np.zeros((H, W), dtype=bool)
for t in SCENE['torches']:
    rr = 0.16 if t['depth'] == 'near' else 0.11 if t['depth'] == 'mid' else 0.07
    near_torch |= ((xx / W - t['x']) ** 2 + ((yy / H - t['y']) * (H / W)) ** 2) < rr ** 2
torch_soft = np.clip(soften(flame.astype(np.float32), 2) * 1.5 + soften((warm & near_torch).astype(np.float32), 4) * 0.9, 0, 1)

# Wall runes: blue glyphs inside the three panels.
blue = (hue > 0.55) & (hue < 0.74) & (sat > 0.30) & (val > 0.40)
panels = np.zeros((H, W), dtype=bool)
for p in SCENE['rune_panels']:
    panels |= window(p['x0'], p['y0'], p['x1'], p['y1'])
runes_soft = np.clip(soften((blue & panels).astype(np.float32), 1.5) * 1.8, 0, 1)

# Floor: everything under the horizon that is not a wall base; a soft trapezoid is enough.
floor = (yy / H > SCENE['horizon_y']) & (np.abs(xx / W - 0.5) < 0.12 + (yy / H - SCENE['horizon_y']) * 1.15)
floor_soft = soften(floor.astype(np.float32), 12)


# ------------------------------------------------------------------ layers
def rgba(color, alpha):
    a = np.clip(alpha, 0, 1)
    px = np.concatenate([np.clip(color, 0, 1), a[..., None]], axis=-1)
    return Image.fromarray((px * 255 + 0.5).astype(np.uint8), 'RGBA')


# Additive layers carry the painted colour, lifted a little so intensity 1.0 restores the plate
# over the darkened base and anything above 1.0 reads as "brighter than painted".
glow_ring = rgba(im * 1.15, ring_soft)
glow_torches = rgba(im * 1.1, torch_soft)
glow_runes = rgba(im * 1.3, runes_soft)

# Base: the plate with each family's light taken out. Under the ring the stone shows through as
# dark, desaturated slab (the glyph grooves stay as faint lines); the torch-lit stone and the rune
# panels are dimmed by the same amount their layers put back at intensity 1.
stone = np.stack([lum * 0.55, lum * 0.58, lum * 0.66], axis=-1)
base = im * (1 - ring_soft[..., None]) + stone * ring_soft[..., None]
base = base * (1 - 0.55 * torch_soft[..., None])
base = base * (1 - 0.70 * runes_soft[..., None])
Image.fromarray((np.clip(base, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out / f'{args.prefix}-base.png')
glow_ring.save(out / f'{args.prefix}-glow-ring.png')
glow_torches.save(out / f'{args.prefix}-glow-torches.png')
glow_runes.save(out / f'{args.prefix}-glow-runes.png')
Image.fromarray((floor_soft * 255).astype(np.uint8), 'L').save(out / f'{args.prefix}-mask-floor.png')
json.dump(SCENE, open(out / 'scene.json', 'w'), indent=2)

# A check sheet: base | base + all layers at 1 (should read as the plate) | the layers alone.
comp = np.clip(base + im * 1.15 * ring_soft[..., None] + im * 1.1 * torch_soft[..., None] + im * 1.3 * runes_soft[..., None], 0, 1)
layers = np.clip(im * 1.15 * ring_soft[..., None] + im * 1.1 * torch_soft[..., None] + im * 1.3 * runes_soft[..., None], 0, 1)
sheet = np.concatenate([base, comp, layers], axis=1)
Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8)).resize((W * 3 // 2, H // 2), Image.LANCZOS).save(out / 'check-sheet.png')
print('ring px', int(violet.sum()), 'flame px', int(flame.sum()), 'runes px', int((blue & panels).sum()))
print('wrote', out)
