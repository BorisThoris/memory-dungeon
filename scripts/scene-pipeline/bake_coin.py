"""Bake the gold coin as a 3D disc turning through half a revolution, for the gold that falls.

The old coin was a flat token from the ambient atlas, squashed to lie down: it read as a sticker.
This ray-casts a real disc - two faces with a raised rim and a struck emblem, a reeded edge with
thickness - lit as polished gold (a key light from the upper left, a warm room reflection above,
dark below, a hard specular), at `FRAMES` angles from face-on (0) through edge-on to the back (pi).
The game picks the frame from the angle between the coin's face and the camera
(`goldCoinMotion` / `goldCoinDraws`), and rotates the sprite to the coin's axis, so a tumbling coin
shows its edge and a coin lying on the floor shows exactly the rim the floor's perspective gives it.

    py -3.12 scripts/scene-pipeline/bake_coin.py

Writes src/renderer/assets/ui/sprites/gold-coin-v1-sprite-turn.{png,webp} and gold-coin-v1-sprites.json.
Deterministic, numpy only.
"""
import json
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
OUT = REPO / 'src' / 'renderer' / 'assets' / 'ui' / 'sprites'
PREFIX = 'gold-coin-v1'
FRAMES = 24
SIZE = 128
SS = 3  # supersampling per axis
R = 0.86  # disc radius in the frame's half-size
T = 0.11  # thickness, as a fraction of the radius' frame units

LIGHT = np.array([-0.45, 0.62, 0.64])
LIGHT /= np.linalg.norm(LIGHT)
VIEW = np.array([0.0, 0.0, 1.0])
HALF = (LIGHT + VIEW) / np.linalg.norm(LIGHT + VIEW)
GOLD = np.array([1.0, 0.76, 0.33])
GOLD_DEEP = np.array([0.55, 0.33, 0.08])


def face_height(r, ang):
    """The struck relief of a face, as a height field over the face (radius r, angle ang)."""
    h = np.zeros_like(r)
    rr = r / R
    # The raised rim, and a fine bead row inside it.
    h += 0.06 * np.clip(1 - np.abs(rr - 0.9) / 0.06, 0, 1)
    h += 0.02 * (np.abs(rr - 0.8) < 0.022) * (0.5 + 0.5 * np.cos(ang * 48))
    # The emblem: a ring and an eight-pointed star.
    h += 0.035 * np.clip(1 - np.abs(rr - 0.58) / 0.035, 0, 1)
    star = 0.38 * (0.55 + 0.45 * np.abs(np.cos(ang * 4))) ** 3
    h += 0.04 * np.clip((star - rr) / 0.04, 0, 1)
    return h


def env(direction):
    """The room reflected in the gold: warm light above, a dark floor below, brighter toward the key light."""
    up = direction[..., 1]
    sky = np.clip(up * 0.8 + 0.35, 0, 1)
    key = np.clip(direction @ LIGHT, 0, 1) ** 6
    return sky[..., None] * GOLD * 1.05 + key[..., None] * np.array([1.0, 0.92, 0.7]) * 0.9 + (1 - sky)[..., None] * GOLD_DEEP * 0.25


def shade(normal, base):
    n = normal / np.linalg.norm(normal, axis=-1, keepdims=True)
    diffuse = np.clip(n @ LIGHT, 0, 1)
    spec = np.clip(n @ HALF, 0, 1) ** 60
    refl = 2 * (n @ VIEW)[..., None] * n - VIEW
    colour = base * (0.18 + 0.55 * diffuse[..., None]) + env(refl) * 0.55 * base + spec[..., None] * np.array([1.0, 0.95, 0.82]) * 1.1
    return colour


def render(theta):
    n = SIZE * SS
    v, u = np.mgrid[0:n, 0:n].astype(np.float64)
    u = (u + 0.5) / n * 2 - 1
    v = -((v + 0.5) / n * 2 - 1)
    c, s = np.cos(theta), np.sin(theta)
    # World ray: origin (u, v, +3) going -z. Local = rotate about x by -theta.
    oy, oz = c * v + s * 3.0, -s * v + c * 3.0
    dy, dz = s * -1.0, c * -1.0
    t_lo = np.full(u.shape, -np.inf)
    t_hi = np.full(u.shape, np.inf)
    # Slab |z'| <= T/2.
    with np.errstate(divide='ignore', invalid='ignore'):
        if abs(dz) > 1e-9:
            t1 = (-T / 2 - oz) / dz
            t2 = (T / 2 - oz) / dz
            slab_in = np.minimum(t1, t2)
            slab_out = np.maximum(t1, t2)
        else:
            inside = np.abs(oz) <= T / 2
            slab_in = np.where(inside, -np.inf, np.inf)
            slab_out = np.where(inside, np.inf, -np.inf)
        # Cylinder u^2 + y'^2 <= R^2 (x' = u along the ray).
        rem = R * R - u * u
        if abs(dy) > 1e-9:
            root = np.sqrt(np.clip(rem, 0, None))
            t1 = (-root - oy) / dy
            t2 = (root - oy) / dy
            cyl_in = np.where(rem > 0, np.minimum(t1, t2), np.inf)
            cyl_out = np.where(rem > 0, np.maximum(t1, t2), -np.inf)
        else:
            inside = oy * oy + u * u <= R * R
            cyl_in = np.where(inside, -np.inf, np.inf)
            cyl_out = np.where(inside, np.inf, -np.inf)
    t_lo = np.maximum(slab_in, cyl_in)
    t_hi = np.minimum(slab_out, cyl_out)
    hit = t_lo <= t_hi
    on_face = slab_in >= cyl_in
    t_lo = np.where(hit & np.isfinite(t_lo), t_lo, 0.0)
    ly = oy + t_lo * dy
    lz = oz + t_lo * dz
    r = np.sqrt(u * u + ly * ly)
    ang = np.arctan2(ly, u)
    # Face normals carry the relief (finite differences of the height field); the edge is reeded.
    eps = 0.004
    hx = (face_height(np.sqrt((u + eps) ** 2 + ly ** 2), np.arctan2(ly, u + eps)) - face_height(np.sqrt((u - eps) ** 2 + ly ** 2), np.arctan2(ly, u - eps))) / (2 * eps)
    hy = (face_height(np.sqrt(u ** 2 + (ly + eps) ** 2), np.arctan2(ly + eps, u)) - face_height(np.sqrt(u ** 2 + (ly - eps) ** 2), np.arctan2(ly - eps, u))) / (2 * eps)
    side = np.sign(lz)
    side[side == 0] = 1
    face_n = np.stack([-hx * 0.9, -hy * 0.9, side], axis=-1)
    reed = 1 + 0.08 * np.cos(ang * 90)
    edge_n = np.stack([u / R * reed, ly / R * reed, np.zeros_like(u)], axis=-1)
    local_n = np.where(on_face[..., None], face_n, edge_n)
    # Back to world: rotate about x by +theta.
    wy = c * local_n[..., 1] - s * local_n[..., 2]
    wz = s * local_n[..., 1] + c * local_n[..., 2]
    world_n = np.stack([local_n[..., 0], wy, wz], axis=-1)
    base = np.where(on_face[..., None], GOLD, GOLD * 0.82)
    # A little wear: the high relief polished brighter.
    relief = face_height(r, ang)
    base = base * np.where(on_face[..., None], (1 + relief * 2.2)[..., None], 1)
    with np.errstate(invalid='ignore', divide='ignore'):
        colour = np.clip(np.nan_to_num(shade(world_n, base)), 0, 1)
    colour = np.where(hit[..., None], colour, 0.0)
    alpha = hit.astype(np.float64)
    rgba = np.concatenate([colour * alpha[..., None], alpha[..., None]], axis=-1)
    # Downsample (premultiplied), then un-premultiply.
    rgba = rgba.reshape(SIZE, SS, SIZE, SS, 4).mean(axis=(1, 3))
    a = rgba[..., 3:4]
    rgb = np.where(a > 1e-6, rgba[..., :3] / np.maximum(a, 1e-6), 0)
    return np.concatenate([rgb, a], axis=-1)


def main():
    strip = np.concatenate([render(np.pi * i / (FRAMES - 1)) for i in range(FRAMES)], axis=1)
    OUT.mkdir(parents=True, exist_ok=True)
    png = OUT / f'{PREFIX}-sprite-turn.png'
    Image.fromarray((np.clip(strip, 0, 1) * 255 + 0.5).astype(np.uint8), 'RGBA').save(png)
    webp = OUT / f'{PREFIX}-sprite-turn.webp'
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(png), '-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', str(webp)], check=True)
    manifest = {
        'plate': [1376, 768],
        'kind': 'coin',
        'sprites': [{'id': 'turn', 'x': 0, 'y': 0, 'w': 0, 'h': 0, 'frames': FRAMES, 'fps': 0, 'sheet': webp.name}],
    }
    (OUT / f'{PREFIX}-sprites.json').write_text(json.dumps(manifest, indent=2) + '\n')
    print('wrote', png, webp.stat().st_size // 1024, 'KB')


main()
