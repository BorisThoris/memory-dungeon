"""Cut the flames out of a painted backdrop and turn each one into an animated sprite.

A painting has its flames baked in: every torch and candle burns at one fixed shape. This lifts each
flame off the wall inside a hand-measured box (colour keys cannot do it: the stone a torch lights
is the same yellow-white as the flame's core), dims it in the plate by the share the sprite will
carry, and warps the cut-out into a loopable flipbook: the base of the flame stays anchored, the body sways on three
incommensurate clocks, the tip stretches and breaks into tongues, the whole thing breathes in
brightness. The game plays the sheet with a stepped CSS animation over the box's position.

    py -3.12 scripts/scene-pipeline/cut_sprites.py <plate.png> <out dir> --boxes <boxes.json> --prefix <prefix>

`boxes.json`: {"kind": "flame"|"candle", "boxes": [[x0, y0, x1, y1], ...]} in plate pixels, each box
tight around one visible flame from the cup or wick to the tip.

Writes:
    <prefix>-plate-still.png       the plate with every flame dimmed by the share the sprite carries (feed this to the segmenter)
    <prefix>-sprite-<id>.png       RGBA flipbook, frames side by side (straight alpha, drawn source-over)
    <prefix>-sprites.json          [{id, x, y, w, h, frames, fps, sheet}] with box fractions of the plate
    sprites-sheet.png              contact sheet: every sprite's frames, for a look before installing
    still-vs-rebuilt.png           the still plate | the still plate plus frame 0 of every sprite
"""
import argparse
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ap = argparse.ArgumentParser()
ap.add_argument('plate')
ap.add_argument('out')
ap.add_argument('--boxes', required=True)
ap.add_argument('--prefix', required=True)
ap.add_argument('--frames', type=int, default=16)
ap.add_argument('--fps', type=int, default=14)
ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--webp-quality', type=int, default=88)
ap.add_argument('--saturate', type=float, default=1.25, help='colour push on the cut: the shell desaturates the room, a flame should still burn')
args = ap.parse_args()
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
rng = np.random.default_rng(args.seed)
spec = json.load(open(args.boxes))
kind = spec.get('kind', 'flame')

src = Image.open(args.plate).convert('RGB')
im = np.asarray(src).astype(np.float32) / 255
H, W, _ = im.shape
val = im.max(-1)
lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mx, mn = im.max(-1), im.min(-1)
d = mx - mn + 1e-6
hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
sat = d / (mx + 1e-6)
yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)

# How much of the box the flame fills, and how the cut is feathered. A torch flame is a teardrop:
# narrow at the cup, widest a third of the way up, tapering to the tip. A candle flame is the same
# shape, smaller and steadier, so it gets less room to move.
KIND = {
    'flame': {'feather': 0.22, 'lit': (0.42, 0.80), 'margin': (0.55, 0.55, 0.70, 0.10), 'motion': 1.0},
    'candle': {'feather': 0.30, 'lit': (0.50, 0.88), 'margin': (0.60, 0.60, 0.60, 0.10), 'motion': 0.55}
}[kind]


def smoothstep(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


def teardrop(x0, y0, x1, y1, feather):
    """Soft window over a box: 1 inside a teardrop that fills it, feathered to 0 at the box edge."""
    cx = (x0 + x1) / 2
    v = np.clip((y1 - yy) / max(y1 - y0, 1), 0, 1)  # 0 at the bottom of the box, 1 at the top
    # Half-width as a fraction of the box's half-width: a bulb low down, a point at the top.
    half = 0.45 + 0.55 * np.sin(np.pi * np.clip(v, 0, 1) ** 0.75)
    half = np.where(v > 0.92, half * (1 - (v - 0.92) / 0.08) ** 0.5, half)
    hw = (x1 - x0) / 2
    dist = np.abs(xx - cx) / np.maximum(half * hw, 1e-3)
    inside_y = (yy >= y0) & (yy <= y1)
    w = smoothstep(1.0, 1.0 - feather, dist) * inside_y
    # Feather the top and bottom rows too so the cut has no straight edge.
    edge = np.minimum((yy - y0) / max((y1 - y0) * feather * 0.6, 1), (y1 - yy) / max((y1 - y0) * feather * 0.6, 1))
    return w * np.clip(edge, 0, 1)


def spine(x0, y0, x1, y1):
    """A soft column that follows the flame: per row, the centroid of the saturated orange inside
    the box (the lit stone beside a torch is as bright as the flame but far less saturated), smoothed
    down the flame, with a Gaussian across it. Keeps the window off the wall the flame lights."""
    orange = smoothstep(0.30, 0.55, sat) * smoothstep(0.0, 0.03, hue) * smoothstep(0.20, 0.15, hue) * smoothstep(0.5, 0.8, val)
    box = orange[y0:y1, x0:x1]
    cols = np.arange(x0, x1, dtype=np.float32)
    mass = box.sum(axis=1)
    cx = np.where(mass > 1e-3, (box * cols).sum(axis=1) / np.maximum(mass, 1e-3), (x0 + x1) / 2)
    # Rows with no orange (the very tip, the root behind the prongs) borrow their neighbours.
    weight = np.clip(mass / max(mass.max(), 1e-3), 0, 1)
    cx = ndimage.gaussian_filter1d(cx * weight + (x0 + x1) / 2 * (1 - weight), 3) / np.maximum(ndimage.gaussian_filter1d(np.ones_like(cx), 3), 1e-3)
    cx = ndimage.gaussian_filter1d(cx, 2.5)
    centre = np.full(H, (x0 + x1) / 2, dtype=np.float32)
    centre[y0:y1] = cx
    width = ndimage.gaussian_filter1d(np.sqrt(np.maximum((box * (cols - cx[:, None]) ** 2).sum(axis=1) / np.maximum(mass, 1e-3), 1.0)), 3)
    sigma = np.full(H, (x1 - x0) * 0.3, dtype=np.float32)
    sigma[y0:y1] = np.clip(width * 1.6, (x1 - x0) * 0.16, (x1 - x0) * 0.5)
    return np.exp(-0.5 * ((xx - centre[:, None]) / sigma[:, None]) ** 2)


boxes = [tuple(int(v) for v in bx) for bx in spec['boxes']]
windows = [teardrop(*bx, KIND['feather']) * spine(*bx) for bx in boxes]

# ------------------------------------------------------------------ the plate without them
# No hole is cut. Filling one (Telea, then darkening) always left something under the flame that
# the torch's rendered light pass, which lands hardest exactly there, lifted into a pale or muddy
# oval the moving sprite could not cover. Instead the flame is *dimmed* in the plate by the share
# the sprite carries, the way the glow layers work: still = plate x (1 - DIM x m), sprite = plate x
# m x LIFT, so at rest still + sprite is the painting a shade hotter, and while the sprite's tongues
# move, what shows through is the flame's own dim core, which is what a burning torch looks like.
# m is the flame mask: the window, gated by brightness (the dark iron prongs in front of the flame
# and the wall between the flame and the box edge keep m = 0), fading out toward the root so the
# cup and the flame's foot never move.
# The dimming is warm, not neutral: a yellow flame scaled down evenly goes olive against the warm
# stone around it, and where a frame's tongues have moved off the painted flame that olive showed
# as a teal ghost. Scaled toward orange it reads as the flame's ember core, which it is.
DIM = np.array([0.55, 0.66, 0.80], dtype=np.float32)
ROOT = 0.22
masks = []
for win, (x0, y0, x1, y1) in zip(windows, boxes):
    lit = smoothstep(KIND['lit'][0], KIND['lit'][1], val)
    root = smoothstep(y1 - (y1 - y0) * ROOT * 0.5, y1 - (y1 - y0) * (ROOT + 0.15), yy)
    masks.append(np.clip(win * lit * smoothstep(0.15, 0.4, lum) * root, 0, 1) ** 0.7)
mask_all = np.clip(np.sum(masks, axis=0), 0, 1)
still = im * (1 - DIM[None, None, :] * mask_all[..., None])
Image.fromarray((np.clip(still, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out / f'{args.prefix}-plate-still.png')


def periodic_noise(u, v, t, seeds):
    """Sum of sines in (u, v) scrolling upward in t; every term is an integer number of cycles per
    loop, so frame N is frame 0 and the sheet loops without a seam."""
    n = np.zeros_like(u)
    for (fu, fv, cycles, phase, amp) in seeds:
        n += amp * np.sin(2 * np.pi * (fu * u + fv * v - cycles * t) + phase)
    return n


def flame_frames(sprite, frames, clocks, base_row, top_row, motion=1.0):
    """Warp one straight-alpha RGBA cut-out into `frames` loopable frames.

    v runs 0 at the base of the flame to 1 at the tip; every motion scales with a(v) so the base
    stays nailed to the cup or wick while the tip does the work.
    """
    h, w, _ = sprite.shape
    rgb = sprite[..., :3] * sprite[..., 3:4]  # premultiply so the warp never smears a fringe
    a = sprite[..., 3]
    yy_, xx_ = np.mgrid[0:h, 0:w].astype(np.float32)
    span = max(base_row - top_row, 4.0)
    v = np.clip((base_row - yy_) / span, 0, 1)
    u = xx_ / max(w - 1, 1)
    anchor = (v * v * (3 - 2 * v)) ** 1.15
    # Low vertical frequencies: a flame bends as one body; anything under ~a third of its height
    # reads as shredding, not fire.
    sway = [(0.0, 1.1, 1, clocks[0], 0.05), (0.0, 2.2, 2, clocks[1], 0.03), (0.5, 3.4, 3, clocks[2], 0.016)]
    stretch = [(0.0, 0.0, 2, clocks[3], 0.07), (0.0, 0.0, 3, clocks[4], 0.032), (0.0, 0.9, 5, clocks[5], 0.016)]
    tongues = [(2.3, 1.6, 2, clocks[0], 0.45), (3.1, 2.7, 3, clocks[1] + 1.1, 0.3), (4.7, 4.2, 5, clocks[2] + 2.2, 0.15)]
    result = []
    for i in range(frames):
        t = i / frames
        dx = w * anchor * periodic_noise(u, v, t, sway) * motion
        dy = -span * anchor * (periodic_noise(u, v, t, stretch) + 0.05) * motion
        coords = np.stack([np.clip(yy_ - dy, 0, h - 1), np.clip(xx_ - dx, 0, w - 1)])
        warped_rgb = np.stack([ndimage.map_coordinates(rgb[..., c], coords, order=1, mode='constant', cval=0.0) for c in range(3)], axis=-1)
        warped_a = ndimage.map_coordinates(a, coords, order=1, mode='constant', cval=0.0)
        # Tongues: a scrolling noise moves the silhouette in and out, carving the edge into licks and
        # letting the tip break, while the body stays solid (a gate that scaled the whole alpha left
        # the flame half-transparent and pale). The base is never touched.
        n = 0.5 + 0.5 * periodic_noise(u, v, t, tongues)
        carved = np.clip(warped_a + 0.6 * motion * anchor * (n - 0.5), 0, 1)
        gate = smoothstep(0.06, 0.4, carved) / np.maximum(warped_a, 1e-3)
        gate = np.clip(gate, 0, 1.6)
        warped_a = np.clip(warped_a * gate, 0, 1)
        warped_rgb = np.clip(warped_rgb * gate[..., None], 0, 1)
        # The whole flame breathes: a slow swell and a faster shiver, small.
        breathe = 1 + 0.10 * np.sin(2 * np.pi * (3 * t) + clocks[3]) + 0.05 * np.sin(2 * np.pi * (5 * t) + clocks[4])
        warped_rgb = np.clip(warped_rgb * breathe, 0, 1)
        warped_a = np.clip(warped_a, 0, 1)
        straight = np.where(warped_a[..., None] > 1e-4, warped_rgb / np.maximum(warped_a[..., None], 1e-4), 0)
        result.append(np.concatenate([np.clip(straight, 0, 1), warped_a[..., None]], axis=-1))
    return result


# ------------------------------------------------------------------ the sprites
manifest = []
strips = []
for idx, (bx, m) in enumerate(zip(boxes, masks)):
    x0, y0, x1, y1 = bx
    bw, bh = x1 - x0, y1 - y0
    ml, mr, mt, mb = KIND['margin']
    # Room to move: the tip stretches upward, the body sways sideways; a little under the base.
    sx0 = max(0, int(x0 - bw * ml))
    sx1 = min(W, int(x1 + bw * mr))
    sy0 = max(0, int(y0 - bh * mt))
    sy1 = min(H, int(y1 + bh * mb))
    # The cut: the painted colour at the mask's alpha, drawn over the dimmed flame in the plate.
    a_box = m[sy0:sy1, sx0:sx1]
    c_box = im[sy0:sy1, sx0:sx1]
    c_lum = lum[sy0:sy1, sx0:sx1][..., None]
    c_box = np.clip(c_lum + (c_box - c_lum) * args.saturate, 0, 1)
    sprite = np.concatenate([c_box, a_box[..., None]], axis=-1).astype(np.float32)
    clocks = rng.uniform(0, 2 * np.pi, size=6)
    frames = flame_frames(sprite, args.frames, clocks, base_row=y1 - sy0, top_row=y0 - sy0, motion=KIND['motion'])
    strip = np.concatenate(frames, axis=1)
    sid = f'{kind}-{idx:02d}'
    sheet_name = f'{args.prefix}-sprite-{sid}.png'
    strip8 = Image.fromarray((strip * 255 + 0.5).astype(np.uint8), 'RGBA')
    strip8.save(out / sheet_name)
    # libwebp occasionally reports an out-of-memory on a small strip straight after the PNG save;
    # a fresh copy at a lighter method has always gone through.
    try:
        strip8.save(out / sheet_name.replace('.png', '.webp'), quality=args.webp_quality, method=6)
    except ValueError:
        Image.open(out / sheet_name).copy().save(out / sheet_name.replace('.png', '.webp'), quality=args.webp_quality, method=4)
    manifest.append({
        'id': sid,
        'x': round(sx0 / W, 5),
        'y': round(sy0 / H, 5),
        'w': round((sx1 - sx0) / W, 5),
        'h': round((sy1 - sy0) / H, 5),
        'frames': args.frames,
        'fps': args.fps,
        'sheet': sheet_name.replace('.png', '.webp')
    })
    strips.append(strip)
    print(f'{sid}: box {sx0},{sy0} {sx1 - sx0}x{sy1 - sy0}')

json.dump({'plate': [W, H], 'kind': kind, 'sprites': manifest}, open(out / f'{args.prefix}-sprites.json', 'w'), indent=2)

# Contact sheet: every flipbook on dark, one sprite per row, scaled to a common frame height.
row_h = 120
rows_img = []
for strip in strips:
    h, w, _ = strip.shape
    scale = row_h / h
    pil = Image.fromarray((strip * 255 + 0.5).astype(np.uint8), 'RGBA').resize((max(1, int(w * scale)), row_h), Image.LANCZOS)
    dark = Image.new('RGBA', pil.size, (12, 10, 16, 255))
    dark.alpha_composite(pil)
    rows_img.append(dark)
sheet = Image.new('RGB', (max(p.width for p in rows_img), row_h * len(rows_img)), (12, 10, 16))
for i, p in enumerate(rows_img):
    sheet.paste(p.convert('RGB'), (0, i * row_h))
sheet.save(out / 'sprites-sheet.png')

# Before/after on the plate itself: the still plate | the still plate with frame 0 of every sprite added.
back = still.copy()
for m, strip in zip(manifest, strips):
    x0, y0 = int(round(m['x'] * W)), int(round(m['y'] * H))
    f0 = strip[:, : strip.shape[1] // m['frames']]
    h, w, _ = f0.shape
    back[y0:y0 + h, x0:x0 + w] = back[y0:y0 + h, x0:x0 + w] * (1 - f0[..., 3:4]) + f0[..., :3] * f0[..., 3:4]
pair = np.concatenate([still, back], axis=1)
Image.fromarray((np.clip(pair, 0, 1) * 255 + 0.5).astype(np.uint8)).save(out / 'still-vs-rebuilt.png')
print(f'{len(manifest)} sprites -> {out}')
