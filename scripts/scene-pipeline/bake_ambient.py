#!/usr/bin/env python3
"""
Bake the ambient sprites the painted scenes share (`src/renderer/components/sceneAmbient.ts`).

Everything a scene moves that the painter did not paint is baked here once and shipped as two
images, so the game draws pre-rendered pixels and computes none of it at runtime:

  ambient-v1.webp      a 1024x704 atlas of small cells: glow dots in each light's colour, a glint,
                       dust, a water drop and its ripple, a smoke puff, leaves, a bat and a moth as
                       flipbooks, a spider, a shooting star, a 512x256 sheet of light shafts, and a gold
                       coin turning in eight 128px frames
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
ATLAS = 1024
ATLAS_H = 704  # eight rows of cells and the shafts, then the coin's turn
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


# ---------------------------------------------------------------- rows 9-10: the coin
# A struck gold coin, ray-traced as a thin disc and turned about its upright axis: eight frames of a
# half turn (the two faces are struck alike, so half a turn is the whole cycle). It is lit the way
# the room is, warm from the torches above and to the left, a cold rim off the blue runes, and it
# reflects a dark room, so it reads as metal in that light and not as a flat yellow token. No glow
# is baked around it: a coin in a dark room is dark gold with hot glints, and the glints are the
# room's own glint cell drawn over it when the turn catches the light.
COIN = 128
COIN_FRAMES = 8
COIN_ROW_Y = 576


def coin_frame(theta: float, ss: int = 4) -> np.ndarray:
    n = COIN * ss
    ax = (np.arange(n) + 0.5) / n * 2 - 1
    u, v = np.meshgrid(ax, -ax)  # v up
    radius, half = 0.86, 0.075
    c, s_ = math.cos(theta), math.sin(theta)
    # The view ray is (0, 0, -1) from z = +4; in the coin's frame (turned by theta about y).
    ox, oy, oz = u * c - 4 * s_, v, u * s_ + 4 * c
    dx, dz = s_, -c
    big = np.full(u.shape, np.inf)
    hit_t, nx, ny, nz = big.copy(), np.zeros_like(u), np.zeros_like(u), np.zeros_like(u)
    face_mask = np.zeros(u.shape, bool)
    lx_face, ly_face = np.zeros_like(u), np.zeros_like(u)
    # The two faces.
    if abs(dz) > 1e-6:
        for side in (1.0, -1.0):
            t = (side * half - oz) / dz
            x = ox + t * dx
            inside = (x * x + oy * oy <= radius * radius) & (t > 0) & (t < hit_t)
            hit_t = np.where(inside, t, hit_t)
            nz = np.where(inside, side, nz)
            nx = np.where(inside, 0.0, nx)
            ny = np.where(inside, 0.0, ny)
            face_mask |= inside
            lx_face = np.where(inside, x * side, lx_face)
            ly_face = np.where(inside, oy, ly_face)
    # The milled edge.
    if abs(dx) > 1e-6:
        disc = radius * radius - oy * oy
        ok = disc >= 0
        root = np.sqrt(np.where(ok, disc, 0))
        for sign in (-1.0, 1.0):
            t = (sign * root - ox) / dx
            z = oz + t * dz
            inside = ok & (np.abs(z) <= half) & (t > 0) & (t < hit_t)
            x = ox + t * dx
            angle = np.arctan2(oy, x)
            reed = 0.18 * np.sin(angle * 90)
            hit_t = np.where(inside, t, hit_t)
            nx = np.where(inside, x / radius - reed * np.sin(angle), nx)
            ny = np.where(inside, oy / radius + reed * np.cos(angle), ny)
            nz = np.where(inside, 0.0, nz)
            face_mask &= ~inside
    hit = np.isfinite(hit_t)
    # The face's relief: a raised rim, a ring of beads, a struck eight-point star; normals from its slope.
    r = np.sqrt(lx_face ** 2 + ly_face ** 2) / radius
    a = np.arctan2(ly_face, lx_face)
    height = 0.55 * np.clip((r - 0.86) / 0.06, 0, 1)
    height += 0.35 * np.exp(-((r - 0.74) / 0.018) ** 2) * (0.5 + 0.5 * np.cos(a * 36)) ** 3
    star = 0.42 * (0.55 + 0.45 * np.abs(np.cos(a * 4)) ** 6)
    height += 0.45 * np.clip((star - r) / 0.06, 0, 1)
    height += 0.25 * np.exp(-(r / 0.09) ** 2)
    gy, gx = np.gradient(height, 2 / n, 2 / n)
    bump = 0.035
    # Face normals in the coin frame, then back to the view.
    fx_ = -gx * bump * np.where(nz >= 0, 1, -1)
    fy_ = gy * bump
    nx = np.where(face_mask, fx_, nx)
    ny = np.where(face_mask, fy_, ny)
    # World normal: turn the coin-frame normal back by theta.
    wx = nx * c + nz * s_
    wz = -nx * s_ + nz * c
    wy = ny
    length = np.sqrt(wx * wx + wy * wy + wz * wz) + 1e-9
    wx, wy, wz = wx / length, wy / length, wz / length
    # Light: a warm torch key up-left and in front, a cold rim behind on the right, a dark room.
    def lit(lx, ly, lz):
        l = np.array([lx, ly, lz]) / math.sqrt(lx * lx + ly * ly + lz * lz)
        return l
    key, rim = lit(-0.55, 0.6, 0.58), lit(0.7, 0.15, -0.35)
    view = np.array([0.0, 0.0, 1.0])
    gold = np.array([1.0, 0.80, 0.40])
    def spec(l, power):
        h = (l + view) / np.linalg.norm(l + view)
        return np.clip(wx * h[0] + wy * h[1] + wz * h[2], 0, 1) ** power
    def diff(l):
        return np.clip(wx * l[0] + wy * l[1] + wz * l[2], 0, 1)
    # Reflection of the room: brighter toward the torch-lit horizon on the left, dark above and below.
    ry = 2 * wz * wy
    rx = 2 * wz * wx
    env = 0.2 + 0.3 * np.exp(-((ry - 0.1) / 0.45) ** 2) * (0.6 + 0.4 * np.clip(-rx, -1, 1))
    warm = np.array([1.0, 0.86, 0.62])
    cold = np.array([0.55, 0.65, 1.0])
    rgb = (gold[None, None, :] * (env[..., None] * warm + 0.42 * diff(key)[..., None] * warm)
           + gold[None, None, :] * 0.9 * spec(key, 28)[..., None] * warm
           + 0.55 * spec(key, 160)[..., None]
           + (0.5 * cold + 0.5 * gold) * 0.22 * spec(rim, 12)[..., None])
    # The edge is darker and rougher than the polished faces.
    rgb = np.where((~face_mask)[..., None], rgb * 0.72, rgb)
    rgb = np.clip(rgb, 0, 1) ** (1 / 1.1)
    rgba = np.dstack([rgb * 255, hit.astype(np.float32) * 255])
    small = Image.fromarray(np.clip(rgba, 0, 255).astype(np.uint8), 'RGBA')
    # Average premultiplied, so the edge does not pick up the black of the empty pixels.
    pm = np.asarray(small, dtype=np.float32)
    pm[..., :3] *= pm[..., 3:4] / 255
    down = pm.reshape(COIN, ss, COIN, ss, 4).mean(axis=(1, 3))
    alpha = down[..., 3:4]
    down[..., :3] = np.where(alpha > 0, down[..., :3] * 255 / np.maximum(alpha, 1e-6), 0)
    return down


coin_strip = np.concatenate([coin_frame(math.pi * index / COIN_FRAMES) for index in range(COIN_FRAMES)], axis=1)
atlas[COIN_ROW_Y:COIN_ROW_Y + COIN, 0:COIN * COIN_FRAMES] = coin_strip
cells['coin'] = {'x': 0, 'y': COIN_ROW_Y, 'w': COIN, 'h': COIN, 'frames': COIN_FRAMES}


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
    json.dumps({'atlas': 'ambient-v1.webp', 'size': [ATLAS, ATLAS_H], 'fog': 'ambient-fog-v1.webp', 'fogSize': [FOG_W, FOG_H], 'cells': cells}, indent=2) + '\n',
    newline='\n',
)
print(f'wrote {len(cells)} cells to {OUT}')
