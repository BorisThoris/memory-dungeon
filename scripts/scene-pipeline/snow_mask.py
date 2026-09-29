"""
Snow on a painting: a mask of the surfaces snow would settle on, derived from the plate itself.

Snow lies on anything that faces up. In a lit painting an upward-facing surface is the bright
band under a darker one (a ledge lit from above, the top of a torch bracket, the rim of the
ring), so the mask is the downward luminance gradient - "dark above, brighter below" - thinned to
the edges that read as tops, thickened downward a few pixels so it reads as a drift rather than a
line, softened, grained, and tinted blue-white. What it produces is a layer the scene screens
over the base and drives with a CSS variable (`--scene-snow`), the same way the light passes are
driven; a blurred copy of it, plus-lighter, is the glow.

    py -3.12 scripts/scene-pipeline/snow_mask.py \
        src/renderer/assets/ui/backgrounds/bg-gameplay-dungeon-ring-v2-base.png \
        src/renderer/assets/ui/backgrounds/overlay-snow-dungeon-v1.png

The centre of the plate is held back (the board sits there) and the bottom margin too (the HUD).
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter


def snow_mask(base: Image.Image, seed: int = 7, tint: tuple[int, int, int] = (235, 244, 255), strength: float = 1.0, depth: int = 6) -> Image.Image:
    rgb = np.asarray(base.convert("RGB"), dtype=np.float32) / 255.0
    lum = 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]
    h, w = lum.shape
    # Blur a little first so the gradient reads brush strokes as surfaces, not noise.
    soft = np.asarray(Image.fromarray((lum * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float32) / 255.0
    down = np.zeros_like(soft)
    down[2:-2] = soft[4:] - soft[:-4]  # brighter below than above: a top-facing edge sits here
    tops = np.clip((down - 0.05) * 6.0, 0.0, 1.0)
    # Only lit surfaces hold snow you can see: drop the edges inside the dark.
    tops *= np.clip((soft - 0.10) * 4.0, 0.0, 1.0)
    # The drift: carry each top down a few pixels with a falling weight.
    drift = np.zeros_like(tops)
    for offset in range(depth + 1):
        weight = max(0.0, 1.0 - (offset / max(1, depth)) ** 1.4)
        drift[offset:] = np.maximum(drift[offset:], tops[: h - offset] * weight)
    # Hold the centre (the board) and the foot (the HUD) back.
    yy, xx = np.mgrid[0:h, 0:w]
    cx, cy = w / 2, h * 0.58
    centre = np.clip(((xx - cx) / (w * 0.30)) ** 2 + ((yy - cy) / (h * 0.30)) ** 2, 0.0, 1.0)
    drift *= 0.25 + 0.75 * centre
    drift *= np.clip((h * 0.94 - yy) / (h * 0.08), 0.0, 1.0)
    # Grain, so the drifts break up like snow rather than reading as a stroke.
    rng = np.random.default_rng(seed)
    grain = rng.random((h, w)).astype(np.float32)
    grain = np.asarray(Image.fromarray((grain * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float32) / 255.0
    drift *= 0.65 + 0.7 * grain
    alpha = np.clip(drift * strength, 0.0, 1.0)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float32) / 255.0
    out = np.zeros((h, w, 4), dtype=np.uint8)
    out[..., 0], out[..., 1], out[..., 2] = tint
    out[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def main() -> None:
    src, dst = Path(sys.argv[1]), Path(sys.argv[2])
    # Optional: a wet-stone sheen instead of snow - thinner, bluer, fainter (`--wet`).
    wet = "--wet" in sys.argv[3:]
    mask = snow_mask(Image.open(src), tint=(150, 200, 255) if wet else (235, 244, 255), strength=0.55 if wet else 1.0, depth=2 if wet else 6)
    dst.parent.mkdir(parents=True, exist_ok=True)
    mask.save(dst)
    cover = np.asarray(mask)[..., 3].mean() / 255.0
    print(f"wrote {dst} ({mask.size[0]}x{mask.size[1]}, mean cover {cover:.3f})")


if __name__ == "__main__":
    main()
