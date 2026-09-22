"""Cut a feathered disc out of a painted backdrop: a thing the game will spin in place.

The portal's vortex is a spiral painted in an arch. Spinning the whole opening would drag the stone
frame with it; spinning a disc that fits inside the opening, feathered over its rim, leaves the
outer arms of the spiral still and dissolves the moving core into them, which is what a vortex
looks like. Writes one RGBA cut-out and a manifest in the same shape `cut_sprites.py` writes
(one frame), so `assets/ui/sprites/index.ts` resolves it like any other sprite.

    py -3.12 scripts/scene-pipeline/cut_disc.py <plate.png> <out dir> --prefix <prefix> --id vortex \\
        --centre 692 385 --radius 95 --feather 35
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--prefix', required=True)
ap.add_argument('--id', default='disc')
ap.add_argument('--centre', type=float, nargs=2, required=True, help='centre of the disc in plate pixels')
ap.add_argument('--radius', type=float, required=True, help='radius at which the cut has faded to nothing')
ap.add_argument('--feather', type=float, default=30, help='width of the fade inside the radius')
ap.add_argument('--webp-quality', type=int, default=88)
args = ap.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)

im = np.asarray(Image.open(args.plate).convert('RGB')).astype(np.float32) / 255
H, W, _ = im.shape
cx, cy = args.centre
r = args.radius
x0, y0 = int(np.floor(cx - r)), int(np.floor(cy - r))
x1, y1 = int(np.ceil(cx + r)), int(np.ceil(cy + r))
x0c, y0c, x1c, y1c = max(0, x0), max(0, y0), min(W, x1), min(H, y1)
yy, xx = np.mgrid[y0c:y1c, x0c:x1c].astype(np.float32)
dist = np.sqrt((xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2)
t = np.clip((r - dist) / max(args.feather, 1e-3), 0, 1)
alpha = t * t * (3 - 2 * t)
rgba = np.concatenate([im[y0c:y1c, x0c:x1c], alpha[..., None]], axis=-1)
sheet_name = f'{args.prefix}-sprite-{args.id}.png'
img = Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA')
img.save(out / sheet_name)
try:
    img.save(out / sheet_name.replace('.png', '.webp'), quality=args.webp_quality, method=6)
except ValueError:
    Image.open(out / sheet_name).copy().save(out / sheet_name.replace('.png', '.webp'), quality=args.webp_quality, method=4)

manifest = {
    'plate': [W, H],
    'kind': 'disc',
    'sprites': [{
        'id': args.id,
        'x': round(x0c / W, 5),
        'y': round(y0c / H, 5),
        'w': round((x1c - x0c) / W, 5),
        'h': round((y1c - y0c) / H, 5),
        'frames': 1,
        'fps': 0,
        'sheet': sheet_name.replace('.png', '.webp')
    }]
}
json.dump(manifest, open(out / f'{args.prefix}-sprites.json', 'w'), indent=2)
print(f'{args.id}: box {x0c},{y0c} {x1c - x0c}x{y1c - y0c} -> {out}')
