#!/usr/bin/env python3
"""
Bake the ambient sprites the painted scenes share (`src/renderer/components/sceneAmbient.ts`).

Everything a scene moves that the painter did not paint is baked here once and shipped as two
images, so the game draws pre-rendered pixels and computes none of it at runtime:

  ambient-v1.webp      a 512x576 atlas of small cells: glow dots in each light's colour, a glint,
                       dust, a water drop and its ripple, a smoke puff, leaves, a bat and a moth as
                       flipbooks, a spider, a shooting star, a gold coin, and a 512x256 sheet of light shafts
  ambient-fog-v1.webp  a 512x256 tile of fog that repeats in both directions
  ambient-v1.json      where each cell is, in pixels

Deterministic (fixed seed), dependencies: numpy and Pillow.

    python3 scripts/scene-pipeline/bake_ambient.py
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parents[2] / 'src' / 'renderer' / 'assets' / 'ui' / 'sprites'
ATLAS = 512
ATLAS_H = 576  # eight rows of cells and the shafts, then one more row
CELL = 64
SS = 4  # supersampling for drawn shapes

rng = np.random.default_rng(20261007)
atlas = np.zeros((ATLAS_H, ATLAS, 4), dtype=np.float32)
cells: dict[str, dict] = {}


def put(name: str, col: int, row: int, rgba: np.ndarray, frames: int = 1) -> None:
    h, w = rgba.shape[:2]
    x, y = col * CELL, row * CELL
    atlas[y:y + h, x:x + w] = rgba
    cells[name] = {'x': x, 'y': y, 'w': w // frames, 'h': h, 'frames': frames}


def radial(size: int) -> np.ndarray:
    ax = (np.arange(size) + 0.5) / size * 2 - 1
    xx, yy = np.meshgrid(ax, ax)
    return np.sqrt(xx * xx + yy * yy)


def glow_dot(core: tuple[int, int, int], halo: tuple[int, int, int], core_r: float = 0.16, strength: float = 1.0) -> np.ndarray:
    """A point of light: a small hot core in `core` inside a wide soft halo in `halo`."""
    r = radial(CELL)
    core_a = np.clip(1 - r / core_r, 0, 1) ** 1.5
    halo_a = np.exp(-(r / 0.42) ** 2 * 2.2) * 0.55 * np.clip(1 - r, 0, 1)
    a = np.clip(core_a + halo_a, 0, 1) * strength
    mix = (core_a / np.maximum(core_a + halo_a, 1e-6))[..., None]
    rgb = np.array(core, dtype=np.float32) * mix + np.array(halo, dtype=np.float32) * (1 - mix)
    return np.dstack([rgb, a * 255])


def shape(draw_fn, w: int = CELL, h: int = CELL, blur: float = 0.0) -> np.ndarray:
    """Draw with Pillow at `SS` times the size and bring it down, for clean small silhouettes."""
    image = Image.new('RGBA', (w * SS, h * SS), (0, 0, 0, 0))
    draw_fn(ImageDraw.Draw(image), w * SS, h * SS)
    if blur:
        image = image.filter(ImageFilter.GaussianBlur(blur * SS))
    return np.asarray(image.resize((w, h), Image.LANCZOS), dtype=np.float32)


# ---------------------------------------------------------------- row 0: glow dots by colour
DOTS = {
    'dotWhite': ((255, 255, 255), (220, 230, 255)),
    'dotTeal': ((191, 245, 234), (90, 220, 200)),
    'dotViolet': ((217, 198, 255), (170, 130, 255)),
    'dotCyan': ((191, 233, 255), (120, 220, 255)),
    'dotEmber': ((255, 210, 122), (255, 150, 40)),
    'dotCinder': ((255, 150, 90), (217, 72, 26)),
    'dotSpore': ((226, 255, 150), (95, 174, 58)),
    'dotFirefly': ((240, 255, 170), (170, 255, 90)),
}
for index, (name, (core, halo)) in enumerate(DOTS.items()):
    put(name, index, 0, glow_dot(core, halo))

# ---------------------------------------------------------------- row 1: small things
# A bubble: a thin bright ring with a highlight.
r = radial(CELL)
ring = np.exp(-((r - 0.55) / 0.07) ** 2)
highlight = np.exp(-(((np.indices((CELL, CELL))[1] - 22) / 7.0) ** 2 + ((np.indices((CELL, CELL))[0] - 20) / 5.0) ** 2))
bubble_a = np.clip(ring * 0.85 + highlight * 0.7 + np.clip(1 - r / 0.55, 0, 1) * 0.08, 0, 1)
put('bubble', 0, 1, np.dstack([np.full((CELL, CELL, 3), (191, 245, 255), dtype=np.float32), bubble_a * 255]))

# A glint: a four-point star.
ax = (np.arange(CELL) + 0.5) / CELL * 2 - 1
gx, gy = np.meshgrid(ax, ax)
star = np.exp(-(np.abs(gx) * 26) ** 0.9) * np.exp(-(gy * 2.2) ** 2) + np.exp(-(np.abs(gy) * 26) ** 0.9) * np.exp(-(gx * 2.2) ** 2)
star = np.clip(star + np.exp(-(r / 0.12) ** 2) * 0.9, 0, 1)
put('glint', 1, 1, np.dstack([np.full((CELL, CELL, 3), (235, 242, 255), dtype=np.float32), star * 255]))

# Dust: a faint, slightly irregular speck.
dust_a = np.exp(-(r / 0.3) ** 2 * 2.0) * 0.8
put('dust', 2, 1, np.dstack([np.full((CELL, CELL, 3), (236, 226, 204), dtype=np.float32), dust_a * 255]))

put('dotGold', 3, 1, glow_dot((255, 236, 180), (255, 190, 90)))

# A falling drop: a short vertical streak, bright at its foot.
drop_a = np.exp(-(gx * 9) ** 2) * np.clip((gy + 1) / 2, 0, 1) ** 2.2 * np.clip(1 - np.abs(gy) ** 6, 0, 1)
put('drop', 4, 1, np.dstack([np.full((CELL, CELL, 3), (190, 215, 240), dtype=np.float32), np.clip(drop_a, 0, 1) * 255]))

# The ripple it leaves: a soft ring, drawn squashed onto the floor and scaled up as it fades.
ripple_a = np.exp(-((r - 0.72) / 0.09) ** 2) * 0.9
put('ripple', 5, 1, np.dstack([np.full((CELL, CELL, 3), (200, 220, 240), dtype=np.float32), ripple_a * 255]))

# A puff of smoke: an uneven soft blob, drawn over the stone (not added to it).
noise = rng.random((8, 8)).astype(np.float32)
noise = np.asarray(Image.fromarray((noise * 255).astype(np.uint8)).resize((CELL, CELL), Image.BICUBIC), dtype=np.float32) / 255
smoke_a = np.clip(np.exp(-(r / 0.55) ** 2 * 2.4) * (0.55 + 0.6 * noise), 0, 1) * 0.75
put('smoke', 6, 1, np.dstack([np.full((CELL, CELL, 3), (168, 170, 182), dtype=np.float32), smoke_a * 255]))


def leaf(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    cx, cy = w / 2, h / 2
    points = []
    for step in range(41):
        t = step / 40
        angle = t * math.pi
        half = math.sin(angle) ** 0.8 * h * 0.16
        points.append((cx - w * 0.34 + t * w * 0.68, cy - half))
    for step in range(41):
        t = 1 - step / 40
        angle = t * math.pi
        half = math.sin(angle) ** 0.8 * h * 0.16
        points.append((cx - w * 0.34 + t * w * 0.68, cy + half))
    draw.polygon(points, fill=(58, 92, 84, 235))
    draw.line([(cx - w * 0.34, cy), (cx + w * 0.34, cy)], fill=(120, 168, 150, 200), width=max(1, SS))


put('leaf', 7, 1, shape(leaf))


# ---------------------------------------------------------------- row 2: the bat and the moth
def bat_frame(phase: float):
    lift = math.sin(phase * 2 * math.pi)

    def draw(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
        cx, cy = w / 2, h / 2 + h * 0.02
        ink = (10, 11, 18, 240)
        for side in (-1, 1):
            tip = (cx + side * w * 0.44, cy - lift * h * 0.26)
            elbow = (cx + side * w * 0.22, cy - h * 0.10 - lift * h * 0.14)
            # Leading edge out to the tip, then a scalloped trailing edge back to the body.
            trailing = [
                (cx + side * w * 0.33, cy + h * 0.02 - lift * h * 0.12),
                (cx + side * w * 0.27, cy + h * 0.10 - lift * h * 0.06),
                (cx + side * w * 0.18, cy + h * 0.05 - lift * h * 0.03),
                (cx + side * w * 0.12, cy + h * 0.12),
                (cx + side * w * 0.04, cy + h * 0.06),
            ]
            d.polygon([(cx, cy - h * 0.05), elbow, tip, *trailing, (cx, cy + h * 0.07)], fill=ink)
        d.ellipse([cx - w * 0.055, cy - h * 0.09, cx + w * 0.055, cy + h * 0.11], fill=ink)
        for side in (-1, 1):
            d.polygon([(cx + side * w * 0.02, cy - h * 0.08), (cx + side * w * 0.055, cy - h * 0.16), (cx + side * w * 0.06, cy - h * 0.06)], fill=ink)

    return draw


BAT_FRAMES = 6
bat = np.concatenate([shape(bat_frame(i / BAT_FRAMES)) for i in range(BAT_FRAMES)], axis=1)
put('bat', 0, 2, bat, frames=BAT_FRAMES)


def moth_frame(open_: float):
    def draw(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
        cx, cy = w / 2, h / 2
        pale = (233, 222, 196, 235)
        spread = 0.10 + 0.20 * open_
        for side in (-1, 1):
            d.polygon([(cx, cy - h * 0.04), (cx + side * w * spread * 1.5, cy - h * (0.24 - 0.14 * (1 - open_))), (cx + side * w * spread * 1.2, cy + h * 0.05), (cx, cy + h * 0.06)], fill=pale)
            d.polygon([(cx, cy + h * 0.02), (cx + side * w * spread, cy + h * 0.18), (cx, cy + h * 0.12)], fill=(210, 198, 172, 225))
        d.ellipse([cx - w * 0.025, cy - h * 0.1, cx + w * 0.025, cy + h * 0.16], fill=(120, 104, 84, 240))

    return draw


put('moth', 6, 2, np.concatenate([shape(moth_frame(1.0)), shape(moth_frame(0.25))], axis=1), frames=2)


# ---------------------------------------------------------------- row 3: the shooting star, the spider, a second leaf
STREAK_W = CELL * 4
sx = (np.arange(STREAK_W) + 0.5) / STREAK_W
sy = (np.arange(CELL) + 0.5) / CELL * 2 - 1
sxx, syy = np.meshgrid(sx, sy)
# Head at the right; the tail thins and fades to the left.
width = 0.035 + 0.11 * sxx ** 2
streak_a = np.exp(-(syy / width) ** 2) * sxx ** 2.4 * np.clip((1 - sxx) * 40, 0, 1)
head = np.exp(-(((sxx - 0.965) * STREAK_W / CELL) ** 2 + syy ** 2) / 0.012)
streak_a = np.clip(streak_a + head, 0, 1)
put('streak', 0, 3, np.dstack([np.full((CELL, STREAK_W, 3), (225, 238, 255), dtype=np.float32), streak_a * 255]))


def spider(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    cx, cy = w / 2, h / 2
    ink = (12, 12, 18, 245)
    for side in (-1, 1):
        for leg in range(4):
            angle = math.radians(-50 + leg * 34)
            knee = (cx + side * w * 0.17 * math.cos(angle), cy + h * 0.17 * math.sin(angle) - h * 0.05)
            foot = (cx + side * w * 0.30 * math.cos(angle * 0.8), cy + h * 0.30 * math.sin(angle) + h * 0.06)
            d.line([(cx, cy), knee, foot], fill=ink, width=max(1, int(SS * 1.6)), joint='curve')
    d.ellipse([cx - w * 0.09, cy - h * 0.02, cx + w * 0.09, cy + h * 0.18], fill=ink)
    d.ellipse([cx - w * 0.055, cy - h * 0.11, cx + w * 0.055, cy + h * 0.02], fill=ink)


put('spider', 4, 3, shape(spider))


def leaf_curled(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    cx, cy = w / 2, h / 2
    points = [(cx - w * 0.3, cy + h * 0.04)]
    for step in range(1, 30):
        t = step / 30
        points.append((cx - w * 0.3 + t * w * 0.6, cy - math.sin(t * math.pi) * h * 0.2 + t * h * 0.03))
    for step in range(30, 0, -1):
        t = step / 30
        points.append((cx - w * 0.3 + t * w * 0.6, cy + math.sin(t * math.pi) * h * 0.06 + t * h * 0.03))
    draw.polygon(points, fill=(44, 72, 78, 235))


put('leafCurled', 5, 3, shape(leaf_curled))

# A warm soft halo, wider than a dot: the pool of light a candle or a firefly throws.
halo_a = np.exp(-(r / 0.62) ** 2 * 2.6) * 0.7 * np.clip(1 - r, 0, 1)
put('haloWarm', 6, 3, np.dstack([np.full((CELL, CELL, 3), (255, 196, 110), dtype=np.float32), halo_a * 255]))
put('haloCool', 7, 3, np.dstack([np.full((CELL, CELL, 3), (130, 200, 255), dtype=np.float32), halo_a * 255]))


# ---------------------------------------------------------------- rows 4..7: light shafts
SHAFT_W, SHAFT_H = 512, 256
yy, xx = np.indices((SHAFT_H, SHAFT_W)).astype(np.float32)
u = xx / SHAFT_W
v = yy / SHAFT_H
shafts = np.zeros((SHAFT_H, SHAFT_W), dtype=np.float32)
# Beams fall from the top edge, leaning right; each has its own width, origin and strength.
for origin, lean, half_width, strength in ((0.16, 0.34, 0.050, 1.0), (0.36, 0.30, 0.032, 0.7), (0.52, 0.38, 0.060, 0.85), (0.74, 0.28, 0.026, 0.55)):
    centre = origin + lean * v
    spread = half_width * (1 + 1.3 * v)
    shafts += strength * np.exp(-((u - centre) / spread) ** 2)
# Streaks along the beams: noise that varies across them and barely along them.
across = rng.random(96).astype(np.float32)
across = np.interp(np.linspace(0, 95, SHAFT_W * 2), np.arange(96), across)
streak_index = np.clip(((u - 0.32 * v) * SHAFT_W + SHAFT_W * 0.5).astype(np.int32), 0, SHAFT_W * 2 - 1)
shafts *= 0.62 + 0.55 * across[streak_index]
# They fade in under the top edge and die out before the floor.
shafts *= np.clip(v * 9, 0, 1) * np.clip(1 - v, 0, 1) ** 1.25
shafts = np.asarray(Image.fromarray(np.clip(shafts * 255, 0, 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.6)), dtype=np.float32) / 255
shaft_rgba = np.dstack([np.full((SHAFT_H, SHAFT_W, 3), (176, 198, 236), dtype=np.float32), np.clip(shafts, 0, 1) * 255 * 0.85])
atlas[256:512, 0:512] = shaft_rgba
cells['shafts'] = {'x': 0, 'y': 256, 'w': SHAFT_W, 'h': SHAFT_H, 'frames': 1}


# ---------------------------------------------------------------- row 8: the coin
def coin(d: ImageDraw.ImageDraw, w: int, h: int) -> None:
    cx, cy = w / 2, h / 2
    radius = w * 0.3
    # Rim, face, the ring struck into it, and a highlight high on the left.
    d.ellipse([cx - radius, cy - radius, cx + radius, cy + radius], fill=(138, 90, 18, 255))
    d.ellipse([cx - radius * 0.9, cy - radius * 0.9, cx + radius * 0.9, cy + radius * 0.9], fill=(241, 194, 77, 255))
    d.ellipse([cx - radius * 0.62, cy - radius * 0.62, cx + radius * 0.62, cy + radius * 0.62], outline=(255, 241, 194, 190), width=max(1, SS))
    d.ellipse([cx - radius * 0.55, cy - radius * 0.62, cx - radius * 0.05, cy - radius * 0.18], fill=(255, 243, 196, 150))


coin_face = shape(coin)
# Its own light, baked in: the glow a drop-shadow filter used to draw on every coin, every frame.
coin_glow = np.exp(-(radial(CELL) / 0.46) ** 2 * 2.4) * 0.55
coin_alpha = np.maximum(coin_face[..., 3], coin_glow * 255)
blend = (coin_face[..., 3:4] / 255)
coin_rgb = coin_face[..., :3] * blend + np.array((255, 210, 90), dtype=np.float32) * (1 - blend)
put('coin', 0, 8, np.dstack([coin_rgb, coin_alpha]))


# ---------------------------------------------------------------- the fog tile
FOG_W, FOG_H = 512, 256
# 1/f noise shaped in the frequency domain: periodic in both directions by construction.
fy = np.fft.fftfreq(FOG_H)[:, None] * FOG_H
fx = np.fft.fftfreq(FOG_W)[None, :] * FOG_W
radius = np.sqrt((fx * 1.5) ** 2 + (fy * 0.75) ** 2)  # stretched sideways: banks, not blobs
# Nothing slower than three waves across the tile, or one swell reads as a stripe when it repeats.
radius = np.maximum(radius, 3.0)
spectrum = (rng.normal(size=(FOG_H, FOG_W)) + 1j * rng.normal(size=(FOG_H, FOG_W))) / radius ** 1.75
spectrum[np.sqrt(fx ** 2 + fy ** 2) < 1.5] = 0
fog = np.real(np.fft.ifft2(spectrum))
fog = (fog - fog.min()) / (fog.max() - fog.min())
fog = np.clip((fog - 0.38) / 0.5, 0, 1) ** 1.3
fog_rgb = np.dstack([fog * 150, fog * 166, fog * 196]).astype(np.uint8)

OUT.mkdir(parents=True, exist_ok=True)
Image.fromarray(np.clip(atlas, 0, 255).astype(np.uint8), 'RGBA').save(OUT / 'ambient-v1.webp', lossless=True, method=6)
Image.fromarray(fog_rgb, 'RGB').save(OUT / 'ambient-fog-v1.webp', quality=88, method=6)
(OUT / 'ambient-v1.json').write_text(
    json.dumps({'atlas': 'ambient-v1.webp', 'size': [ATLAS, ATLAS_H], 'fog': 'ambient-fog-v1.webp', 'fogSize': [FOG_W, FOG_H], 'cells': cells}, indent=2) + '\n'
)
print(f'wrote {len(cells)} cells to {OUT}')
