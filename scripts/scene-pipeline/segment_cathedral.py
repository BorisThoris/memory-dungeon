"""Split the painted cathedral (main menu, game over) into a base and additive light layers.

The nave has two kinds of light: the candles on their stands, whose warm glow pools on the pillars,
the rails and the floor, and the teal spirit-light drifting up the far arch with its scatter of
sparks. Each is keyed out by hue into its own RGBA layer and dimmed in the base, so the game can
breathe the wisps, flicker the candlelight and play the candle flames as sprites over it.

    py -3.12 scripts/scene-pipeline/segment_cathedral.py <plate.png> <out dir> [--prefix bg-main-menu-cathedral-v2]

Writes (all the plate's size):
    <prefix>-base.png          RGB, the nave with the light taken down
    <prefix>-glow-candles.png  RGBA, the candlelight on the stone (additive; the flame cores are sprites)
    <prefix>-glow-wisps.png    RGBA, the teal light and its sparks (additive)
    check-sheet.png            base | base + layers at 1 (~ the plate) | layers alone
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--prefix', default='bg-main-menu-cathedral-v2')
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


# Candlelight: warm, saturated, and in the lower half where the stands are; the dim amber of the
# vault's stone far above is the painting's own colour, not light, and stays in the base.
warm = (hue > 0.03) & (hue < 0.15) & (sat > 0.35) & (val > 0.30) & (yy / H > 0.36)
candles_soft = np.clip(soften(warm.astype(np.float32), 5) * 1.3, 0, 1)

# The wisps: teal to cyan, anywhere.
teal = (hue > 0.40) & (hue < 0.58) & (sat > 0.22) & (val > 0.22)
wisps_soft = np.clip(soften(teal.astype(np.float32), 2.5) * 1.6, 0, 1)


def rgba(color, alpha):
    a = np.clip(alpha, 0, 1)
    px = np.concatenate([np.clip(color, 0, 1), a[..., None]], axis=-1)
    return Image.fromarray((px * 255 + 0.5).astype(np.uint8), 'RGBA')


glow_candles = rgba(im * 1.1, candles_soft)
glow_wisps = rgba(im * 1.3, wisps_soft)
base = im * (1 - 0.55 * candles_soft[..., None])
base = base * (1 - 0.7 * wisps_soft[..., None])
Image.fromarray((np.clip(base, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out / f'{args.prefix}-base.png')
glow_candles.save(out / f'{args.prefix}-glow-candles.png')
glow_wisps.save(out / f'{args.prefix}-glow-wisps.png')

comp = np.clip(base + im * 1.1 * candles_soft[..., None] + im * 1.3 * wisps_soft[..., None], 0, 1)
layers = np.clip(im * 1.1 * candles_soft[..., None] + im * 1.3 * wisps_soft[..., None], 0, 1)
sheet = np.concatenate([base, comp, layers], axis=1)
Image.fromarray((np.clip(sheet, 0, 1) * 255).astype(np.uint8)).resize((W * 3 // 2, H // 2), Image.LANCZOS).save(out / 'check-sheet.png')
print('candlelight px', int(warm.sum()), 'wisp px', int(teal.sum()))
print('wrote', out)
