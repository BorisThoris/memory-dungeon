"""Find the candle flames in a painted backdrop and write their boxes for `cut_sprites.py`.

Candles are the one case a colour key can handle: a small yellow-white flame on a dark room, with
nothing else that bright nearby except the candle's own wax. Each bright warm blob is a candle
(or a row of them); the flame is the blob's top, about as tall as it is wide and a bit more, and
side-by-side flames split on the gaps between their cores. Review `candles-vis.png` before using
the boxes: a lit capital or a gilded edge can sneak in and is easy to delete by hand.

    py -3.12 scripts/scene-pipeline/find_candles.py <plate.png> <boxes.json> [--vis candles-vis.png]
"""
import argparse
import json

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--vis', default=None)
ap.add_argument('--min-area', type=int, default=40)
ap.add_argument('--min-height', type=int, default=18)
args = ap.parse_args()

im = np.asarray(Image.open(args.plate).convert('RGB')).astype(np.float32) / 255
H, W, _ = im.shape
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
sat = d / (mx + 1e-6)
bright = (hue > 0.05) & (hue < 0.2) & (mx > 0.8) & (sat > 0.15)

labels, count = ndimage.label(ndimage.binary_dilation(bright, iterations=2))
boxes = []
for k in range(1, count + 1):
    blob = labels == k
    if int((blob & bright).sum()) < args.min_area:
        continue
    ys, xs = np.nonzero(blob)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    if y1 - y0 < args.min_height:
        continue
    # Split a row of candles on the gaps between their cores, using the top of the blob only (the
    # sticks below merge into one bright mass but the flames stand apart).
    band = bright[y0:y0 + max(12, (y1 - y0) // 3), x0:x1]
    cols = band.sum(axis=0) > 0
    runs = []
    start = None
    for i, on in enumerate(list(cols) + [False]):
        if on and start is None:
            start = i
        elif not on and start is not None:
            runs.append((start, i))
            start = None
    for (cx0, cx1) in runs:
        w = cx1 - cx0
        if w < 4:
            continue
        # The flame: the top of this column run, as tall as the run is wide and a half again, but
        # never below the blob's own top third (the wax is below that).
        top_rows = np.nonzero(bright[y0:y1, x0 + cx0:x0 + cx1].sum(axis=1) > 0)[0]
        fy0 = y0 + int(top_rows.min()) if top_rows.size else y0
        fy1 = min(y1, fy0 + max(int(w * 1.5), 10))
        boxes.append([x0 + cx0 - 1, fy0 - 1, x0 + cx1 + 1, fy1])
boxes.sort()
json.dump({'plate': args.plate.replace('\\', '/').split('/')[-1], 'kind': 'candle', 'boxes': boxes}, open(args.out, 'w'), indent=2)
print(f'{len(boxes)} candle flames -> {args.out}')

if args.vis:
    vis = Image.fromarray((im * 0.5 * 255).astype(np.uint8))
    draw = ImageDraw.Draw(vis)
    for x0, y0, x1, y1 in boxes:
        draw.rectangle([x0, y0, x1, y1], outline=(255, 0, 255))
    vis.save(args.vis)
