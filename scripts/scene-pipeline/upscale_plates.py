#!/usr/bin/env python3
"""
The painted scenes' runtime WebP files at half again the painting's size (2064x1152), from the
1376x768 PNG masters beside them. `SceneCanvas` gives a desktop up to 1.5 canvas pixels per
painting pixel (`SCENE_CANVAS_MAX_SCALE`); these are the pixels it shows. The masters stay as the
pipeline (`scene.sh`, `cathedral.sh`, `portal.sh`) makes them, so re-running a pipeline and then this
is all a repaint takes.

Three kinds of layer, three treatments:

  plate   an opaque painting (a base, the shop, the void): Real-ESRGAN x4, then Lanczos down.
  glow    an additive RGBA layer keyed out of a painting (torch flames, runes, stars): the light
          it adds is rgb x alpha, so that product is upscaled as a painting on black and the alpha
          beside it smoothly, and rgb is recovered from the two. A straight-alpha upscale would
          drag the black of the empty pixels into every edge.
  light   a Cycles light-group pass (`blender_scene_lights.py`): the painting under a light. The
          room in Blender is a chamfered box, so where its planes meet the light jumps along a
          straight line the painting does not have (the pale wedges over the vault and the
          floor), and the pass carries the render's sampling noise. Only the light itself is
          kept: light = blur(pass) / blur(base), a smooth field with no seam and no grain, and the
          layer is the upscaled base under that light. The painting's detail is the base's.

    E:/avatar-scan/venv/Scripts/python.exe -I scripts/scene-pipeline/upscale_plates.py [--only name ...]

Needs torch + basicsr + realesrgan + scipy (the avatar-scan venv on this PC) and the
`RealESRGAN_x4plus.pth` weights (`--weights`, default E:/avatar-scan/models).
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
BACKGROUNDS = REPO / 'src' / 'renderer' / 'assets' / 'ui' / 'backgrounds'
TARGET = (2064, 1152)
QUALITY = 86
# The light field's softness, in master pixels: wide enough to lose a plane seam, narrow enough to
# keep a torch's pool on its own stretch of wall.
LIGHT_SIGMA = 26

DUNGEON = 'bg-gameplay-dungeon-ring-v2'
CATHEDRAL = 'bg-main-menu-cathedral-v2'
PORTAL = 'bg-mode-classic-v2'

# name -> (kind, the base a light pass was rendered over)
LAYERS: dict[str, tuple[str, str | None]] = {
    f'{DUNGEON}-base': ('plate', None),
    f'{DUNGEON}-glow-ring': ('glow', None),
    f'{DUNGEON}-glow-runes': ('glow', None),
    f'{DUNGEON}-glow-torches': ('glow', None),
    f'{DUNGEON}-light-ring': ('light', f'{DUNGEON}-base'),
    f'{DUNGEON}-light-torches-l': ('light', f'{DUNGEON}-base'),
    f'{DUNGEON}-light-torches-r': ('light', f'{DUNGEON}-base'),
    'bg-gameplay-shop-v1': ('plate', None),
    'bg-gameplay-void-v1': ('plate', None),
    f'{CATHEDRAL}-base': ('plate', None),
    f'{CATHEDRAL}-glow-candles': ('glow', None),
    f'{CATHEDRAL}-glow-wisps': ('glow', None),
    f'{PORTAL}-base': ('plate', None),
    f'{PORTAL}-glow-moon': ('glow', None),
    f'{PORTAL}-glow-runes': ('glow', None),
    f'{PORTAL}-stars': ('glow', None),
}


class Upscaler:
    def __init__(self, weights: Path) -> None:
        from basicsr.archs.rrdbnet_arch import RRDBNet
        from realesrgan import RealESRGANer

        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        self.net = RealESRGANer(scale=4, model_path=str(weights), model=model, tile=512, tile_pad=16, pre_pad=0, half=True, gpu_id=0)

    def rgb(self, rgb: np.ndarray) -> np.ndarray:
        """float 0..1 RGB at master size -> float 0..1 RGB at TARGET."""
        bgr = (np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8)[:, :, ::-1]
        out, _ = self.net.enhance(bgr, outscale=4)
        big = Image.fromarray(np.ascontiguousarray(out[:, :, ::-1]))
        return np.asarray(big.resize(TARGET, Image.LANCZOS), dtype=np.float32) / 255


def load(name: str) -> np.ndarray:
    return np.asarray(Image.open(BACKGROUNDS / f'{name}.png'), dtype=np.float32) / 255


def smooth_resize(channel: np.ndarray) -> np.ndarray:
    image = Image.fromarray(channel.astype(np.float32), 'F')
    return np.asarray(image.resize(TARGET, Image.BICUBIC), dtype=np.float32)


def blur(rgb: np.ndarray, sigma: float) -> np.ndarray:
    from scipy.ndimage import gaussian_filter

    return gaussian_filter(rgb, sigma=(sigma, sigma, 0), mode='reflect')


def save(name: str, rgba: np.ndarray) -> None:
    data = (np.clip(rgba, 0, 1) * 255 + 0.5).astype(np.uint8)
    mode = 'RGBA' if data.shape[2] == 4 else 'RGB'
    path = BACKGROUNDS / f'{name}.webp'
    # `exact` keeps the colour under transparent pixels, which a filtered draw samples at the edges.
    Image.fromarray(data, mode).save(path, quality=QUALITY, method=6, exact=True)
    print(f'  {name:48s} {data.shape[1]}x{data.shape[0]} {path.stat().st_size // 1024:5d} KB')


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--only', nargs='*', default=None)
    parser.add_argument('--weights', type=Path, default=Path('E:/avatar-scan/models/RealESRGAN_x4plus.pth'))
    args = parser.parse_args()
    names = [name for name in LAYERS if not args.only or name in args.only]
    up = Upscaler(args.weights)
    plates: dict[str, np.ndarray] = {}

    def plate(name: str) -> np.ndarray:
        if name not in plates:
            plates[name] = up.rgb(load(name)[..., :3])
        return plates[name]

    for name in names:
        kind, base_name = LAYERS[name]
        if kind == 'plate':
            save(name, plate(name))
        elif kind == 'glow':
            rgba = load(name)
            alpha = rgba[..., 3]
            emission = up.rgb(rgba[..., :3] * alpha[..., None])
            alpha_up = np.clip(smooth_resize(alpha), 0, 1)
            # Where the mask is all but empty, keep the light the upscale found and let the mask be its brightness.
            alpha_out = np.maximum(alpha_up, emission.max(axis=2))
            rgb = emission / np.maximum(alpha_out[..., None], 1e-4)
            save(name, np.dstack([np.clip(rgb, 0, 1), alpha_out]))
        else:
            assert base_name is not None
            light_pass = load(name)[..., :3]
            base = load(base_name)[..., :3]
            field = blur(light_pass, LIGHT_SIGMA) / (blur(base, LIGHT_SIGMA) + 0.004)
            # The same light in all: the pass's total, which the blur and the dropped noise would shave.
            field *= light_pass.mean(axis=(0, 1)) / np.maximum((base * field).mean(axis=(0, 1)), 1e-6)
            field_up = np.dstack([smooth_resize(field[..., c]) for c in range(3)])
            save(name, plate(base_name) * field_up)


if __name__ == '__main__':
    main()
