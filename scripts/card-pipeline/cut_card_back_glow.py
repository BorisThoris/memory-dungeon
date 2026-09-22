"""Key the light out of a painted card plate into an additive glow layer.

The card back is a painting with its light baked in: the blue runes and gems burn at one fixed
level whatever the run is doing. This lifts them into their own RGBA layer, so the game can
composite `plate + glow x heat(t)` and let the backs answer the streak — the same trick the room's
backdrops use (`scripts/scene-pipeline/segment_scene.py`), applied to a card.

Three pieces, because they should not rise together:
    runes  — the cyan glyphs and gem cores, the card's own light, over the whole plate
    gold   — the filigree, which should only catch fire near Fever
    spin   — the labyrinth medallion's light alone, cropped to a feathered disc so the game can
             turn it over the still plate: the mechanism lights up and starts moving as the streak
             climbs, with nothing erased from the painting underneath

    py -3.12 scripts/card-pipeline/cut_card_back_glow.py <plate.png> <out dir> --prefix card-back

Writes `<prefix>-glow-runes.png` and `<prefix>-glow-gold.png` (RGBA, additive), plus a check sheet.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--prefix', default='card-back')
ap.add_argument('--height', type=int, default=1536, help='encode height; matches the runtime plate')
ap.add_argument('--disc', type=float, nargs=3, default=None, metavar=('CX', 'CY', 'R'),
                help='medallion centre and radius as fractions of the plate, for the spinning layer')
ap.add_argument('--disc-feather', type=float, default=0.22, help='fade width as a fraction of the radius')
args = ap.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

src = Image.open(args.plate).convert('RGB')
if src.height != args.height:
    src = src.resize((max(1, round(src.width * args.height / src.height)), args.height), Image.LANCZOS)
im = np.asarray(src).astype(np.float32) / 255
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
sat = d / (mx + 1e-6)
val = mx


def soften(mask, radius):
    m = Image.fromarray((np.clip(mask, 0, 1) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(m).astype(np.float32) / 255


def rgba(color, alpha):
    a = np.clip(alpha, 0, 1)
    px = np.concatenate([np.clip(color, 0, 1), a[..., None]], axis=-1)
    return Image.fromarray((px * 255 + 0.5).astype(np.uint8), 'RGBA')


# The runes and gem cores: cyan through blue, saturated, and bright enough to be light rather than
# painted shadow. Grown a little so each glyph keeps the halo it throws on the card.
runes = (hue > 0.44) & (hue < 0.62) & (sat > 0.30) & (val > 0.40)
runes_soft = np.clip(soften(runes.astype(np.float32), 3.0) * 2.6, 0, 1)

# The filigree: warm, bright metal. Kept separate so it can stay dark until the chain is high.
gold = (hue > 0.06) & (hue < 0.16) & (sat > 0.25) & (val > 0.45)
gold_soft = np.clip(soften(gold.astype(np.float32), 2.0) * 1.9, 0, 1)

glow_runes = rgba(np.clip(im * 2.1, 0, 1), runes_soft)
glow_gold = rgba(im * 1.2, gold_soft)
glow_runes.save(out / f'{args.prefix}-glow-runes.png')
glow_gold.save(out / f'{args.prefix}-glow-gold.png')

# The spinning medallion: every luminous line inside the disc, faded out at its rim so the turning
# copy dissolves into the still painting instead of ending on a hard circle.
if args.disc:
    cx, cy, rad = args.disc[0] * W, args.disc[1] * H, args.disc[2] * min(W, H)
    yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
    dist = np.sqrt((xx - cx) ** 2 + (yy - cy) ** 2)
    t = np.clip((rad - dist) / max(rad * args.disc_feather, 1e-3), 0, 1)
    ring = t * t * (3 - 2 * t)
    lit = np.clip(runes_soft * 1.4 + gold_soft * 1.15, 0, 1) * ring
    x0, x1 = max(0, int(cx - rad)), min(W, int(cx + rad))
    y0, y1 = max(0, int(cy - rad)), min(H, int(cy + rad))
    rgba(np.clip(im[y0:y1, x0:x1] * 1.9, 0, 1), lit[y0:y1, x0:x1]).save(out / f'{args.prefix}-spin.png')
    print(f'spin disc {x1 - x0}x{y1 - y0} at {x0},{y0} (centre {cx:.0f},{cy:.0f} r {rad:.0f})')

# Check sheet: the plate | plate + runes | plate + runes + gold, at the strengths the game can reach.
comp_runes = np.clip(im + im * 1.35 * runes_soft[..., None], 0, 1)
comp_both = np.clip(comp_runes + im * 1.2 * gold_soft[..., None], 0, 1)
sheet = np.concatenate([im, comp_runes, comp_both], axis=1)
Image.fromarray((sheet * 255).astype(np.uint8)).resize((W * 3 // 3, H // 3), Image.LANCZOS).save(out / 'check-sheet.png')
print(f'runes {int(runes.sum())} px, gold {int(gold.sum())} px -> {out}')
