"""Split the painted portal clearing (the Classic poster, behind Choose Your Path) into a base and
additive light layers.

Three families of light: the cyan of the runes on the arch and the glowing plants at its foot, the
moon and its halo, and the stars. Each is keyed out into its own RGBA layer and dimmed in the
base, so the game can breathe the runes, pulse the moon and twinkle the stars while the vortex
(`cut_disc.py`) spins in the arch.

    py -3.12 scripts/scene-pipeline/segment_portal.py <plate.png> <out dir> [--prefix bg-mode-classic-v2]

Writes (all the plate's size):
    <prefix>-base.png          RGB, the clearing with the light taken down
    <prefix>-glow-runes.png    RGBA, the cyan of the arch's runes and the plants (additive)
    <prefix>-glow-moon.png     RGBA, the moon and its halo (additive)
    <prefix>-stars.png         RGBA, the stars (additive)
    check-sheet.png            base | base + layers at 1 (~ the plate) | layers alone
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--prefix', default='bg-mode-classic-v2')
args = ap.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

im = np.asarray(Image.open(args.plate).convert('RGB')).astype(np.float32) / 255
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
sat = d / (mx + 1e-6)
val = mx
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)


def soften(mask, radius):
    m = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(m).astype(np.float32) / 255


# The arch's opening: the vortex is blue-violet-white and must not be keyed as rune light, so the
# cyan key is kept off a box round the opening (the vortex sprite carries the opening's motion).
opening = (xx / W > 0.43) & (xx / W < 0.575) & (yy / H > 0.36) & (yy / H < 0.74)

# Runes and plants: cyan, saturated, bright, anywhere but the opening.
cyan = (hue > 0.42) & (hue < 0.56) & (sat > 0.32) & (val > 0.45) & ~opening
runes_soft = np.clip(soften(cyan.astype(np.float32), 2) * 1.6, 0, 1)

# The moon: the near-white disc top right and the halo round it.
sky = yy / H < 0.30
moon_core = (val > 0.86) & (sat < 0.18) & sky & (xx / W > 0.6)
moon_soft = np.clip(soften(moon_core.astype(np.float32), 3) * 1.4 + soften(moon_core.astype(np.float32), 24) * 0.9, 0, 1)

# Stars: small bright specks in the sky that are not the moon (or the crescent).
bright = (val > 0.62) & (sat < 0.3) & sky
labels, count = ndimage.label(bright)
sizes = ndimage.sum(bright, labels, range(1, count + 1))
star_labels = {k + 1 for k, size in enumerate(sizes) if size <= 40}
stars = np.isin(labels, list(star_labels)) if star_labels else np.zeros_like(bright)
stars_soft = np.clip(soften(stars.astype(np.float32), 1.2) * 2.0, 0, 1)


def rgba(color, alpha):
    a = np.clip(alpha, 0, 1)
    px = np.concatenate([np.clip(color, 0, 1), a[..., None]], axis=-1)
    return Image.fromarray((px * 255 + 0.5).astype(np.uint8), 'RGBA')


glow_runes = rgba(im * 1.2, runes_soft)
glow_moon = rgba(im * 1.05, moon_soft)
glow_stars = rgba(im * 1.3, stars_soft)
base = im * (1 - 0.6 * runes_soft[..., None])
base = base * (1 - 0.5 * moon_soft[..., None])
base = base * (1 - 0.8 * stars_soft[..., None])
Image.fromarray((np.clip(base, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out / f'{args.prefix}-base.png')
glow_runes.save(out / f'{args.prefix}-glow-runes.png')
glow_moon.save(out / f'{args.prefix}-glow-moon.png')
glow_stars.save(out / f'{args.prefix}-stars.png')

layers = np.clip(im * 1.2 * runes_soft[..., None] + im * 1.05 * moon_soft[..., None] + im * 1.3 * stars_soft[..., None], 0, 1)
sheet = np.concatenate([base, np.clip(base + layers, 0, 1), layers], axis=1)
Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8)).resize((W * 3 // 2, H // 2), Image.LANCZOS).save(out / 'check-sheet.png')
print('rune px', int(cyan.sum()), 'moon px', int(moon_core.sum()), 'stars', len(star_labels))
print('wrote', out)
