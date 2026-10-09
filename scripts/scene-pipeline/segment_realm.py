"""Split a realm's painted room into the two layers the game lights: a dark base and one additive glow.

A realm room (`realmRoomArt.ts`) is drawn as `base + glow x (0.35 + 0.65 x combo heat)`
(`gameplaySceneFrame.ts`), so unlike the dungeon ring it needs no per-family layers, no sprites and
no Blender passes: one key for the realm's own light. That light is the realm's hue (the ice's
cyan, the lava's orange, the tide's teal, the storm's violet, the grove's green) where it is
saturated and lit, plus anything near white, which in these paintings is always a light source.

    py -3.12 scripts/scene-pipeline/segment_realm.py <plate.png> <realm> <out dir> [--prefix bg-gameplay-realm-<realm>-v1]

Writes (the plate's size):
    <prefix>-base.png   RGB, the room with its light taken down (what a cold combo starts from)
    <prefix>-glow.png   RGBA, the realm's light (additive, `lighter`)
    <prefix>-check.png  base | base + glow at a cold combo (0.35) | at full heat (1.0) | glow alone
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

# Hue windows as fractions of the wheel (0 red, 1/6 yellow, 1/3 green, 1/2 cyan, 2/3 blue, 5/6 magenta).
REALM_HUES = {
    'frost': (0.45, 0.62),
    'ember': (0.98, 0.13),   # wraps through red
    'tide': (0.40, 0.56),
    'storm': (0.66, 0.86),
    'grove': (0.20, 0.42),
}
# Where the realm's light starts, as (saturation, value) ramps. The grove's glow is moss and fungus
# in a dark crypt, darker than the others' light: at the shared ramps it keyed 0.6 % of the plate.
DEFAULT_RAMPS = ((0.25, 0.55), (0.35, 0.75))
REALM_RAMPS = {
    'grove': ((0.30, 0.60), (0.22, 0.50)),
}

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('realm', choices=sorted(REALM_HUES))
ap.add_argument('out')
ap.add_argument('--prefix', default=None)
ap.add_argument('--take', type=float, default=0.6, help='share of the keyed light removed from the base')
ap.add_argument('--base-mean', type=float, default=0.17, help='ceiling on the base mean luminance')
args = ap.parse_args()
prefix = args.prefix or f'bg-gameplay-realm-{args.realm}-v1'
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

im = np.asarray(Image.open(args.plate).convert('RGB')).astype(np.float32) / 255
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
sat = d / (mx + 1e-6)
lum = 0.2126 * r + 0.7152 * g + 0.0722 * b


def soften(mask, radius):
    m = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(m).astype(np.float32) / 255


def ramp(x, lo, hi):
    return np.clip((x - lo) / (hi - lo), 0, 1)


h0, h1 = REALM_HUES[args.realm]
in_band = (hue >= h0) & (hue <= h1) if h0 < h1 else (hue >= h0) | (hue <= h1)
# The realm's light: in its hue, saturated, and lit; graded by value so a dim tint stays in the base.
(s0, s1), (v0, v1) = REALM_RAMPS.get(args.realm, DEFAULT_RAMPS)
tinted = in_band * ramp(sat, s0, s1) * ramp(mx, v0, v1)
# Near-white highlights: lightning, the ice's core, the lava's white-hot seams.
hot = ramp(lum, 0.70, 0.92)
light = np.clip(soften(np.maximum(tinted, hot), 2.0) * 1.3, 0, 1)


def rgba(color, alpha):
    px = np.concatenate([np.clip(color, 0, 1), np.clip(alpha, 0, 1)[..., None]], axis=-1)
    return Image.fromarray((px * 255 + 0.5).astype(np.uint8), 'RGBA')


# The glow carries the painted colour lifted a little, so at full heat the room is a touch brighter
# than painted; the base keeps the rest of it, so a cold combo still reads as the same room.
# A base brighter than the ring's (the frost's pale ice) is brought down to it: the cards are read
# against the base, and the ring's base sits near 0.15 mean luminance. The glow is not, so the heat
# still lifts the room toward the painting.
glow_rgb = im * 1.1
base = im * (1 - args.take * light[..., None])
base_lum = float((0.2126 * base[..., 0] + 0.7152 * base[..., 1] + 0.0722 * base[..., 2]).mean())
base_gain = min(1.0, args.base_mean / base_lum)
base = base * base_gain
Image.fromarray((np.clip(base, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out / f'{prefix}-base.png')
rgba(glow_rgb, light).save(out / f'{prefix}-glow.png')

added = glow_rgb * light[..., None]
sheet = np.concatenate([base, np.clip(base + 0.35 * added, 0, 1), np.clip(base + added, 0, 1), np.clip(added, 0, 1)], axis=1)
Image.fromarray((sheet * 255).astype(np.uint8)).resize((W * 2, H // 2), Image.LANCZOS).save(out / f'{prefix}-check.png')
print(f'{args.realm}: light covers {float((light > 0.5).mean()) * 100:.1f}% of the plate, mean {float(light.mean()):.3f}; base gain {base_gain:.2f}; wrote {out}')
