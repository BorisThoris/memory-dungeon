"""Break a realm's painted room into the layers that make it live (2026-10-09).

The first cut of the realm rooms was a dark base and one glow: a still painting with a light on it.
The owner's word: "the new backgrounds aren't broken down with animated layers from them". This does
for each realm room what scene.sh did for the dungeon ring, from the painting itself:

1. **Families of light.** Each of the room's lights (`realms.json`: the lava seams, the braziers, the
   rune ring, the ice, the light shaft, the painted lightning...) is keyed out by hue, saturation and
   value inside the parts of the painting where it lives, each pixel's light going to the first
   family that claims it, and becomes its own additive layer the game drives on its own clock
   (`realmRoomLife.ts`). Their light comes out of the base.
2. **Moving parts.** Regions of the painting are cut out and set moving as loopable flipbooks: lava
   flowing down a seam, a brazier's flame licking up, the water rippling, the clouds billowing, vines
   and ferns swaying, a sweep of light running up the ice, light falling through the shaft. A region
   moves the painting itself (drawn over the base) or one family's light (drawn added at that
   family's level; the static layer is cut out under it so nothing doubles).

    py -3.12 scripts/scene-pipeline/realm_layers.py [realm ...] [--scale 2] [--check-dir D:/agent-work/...]

With --scale 2 it cuts from the painting at twice its size (upscale_realms.py: -2x.png) and writes
the base at that size, so a phone, which shows the middle of the room across its whole height, sees
the painting sharp; the lights are written at the painting's own size (they are soft) and the
flipbooks at the sizes realms.json gives them. The parts that move the painting itself (water,
clouds, vines) are not baked here any more: the game warps them live from the base, band by band
(`realmRoomWarpDraws` in realmRoomLife.ts), so they are as sharp as the base on any screen.

Reads src/renderer/assets/ui/backgrounds/bg-gameplay-realm-<realm>-v1.png (the painting) and writes
next to it -base and -glow-<family> (PNG masters + WebP), and the flipbooks with their manifest into
src/renderer/assets/ui/sprites/ (bg-gameplay-realm-<realm>-v1-sprite-<id>, -sprites.json). With
--check-dir it also writes a contact sheet and an animated GIF of each room put back together.
Deterministic: numpy and OpenCV, no randomness.
"""
import argparse
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
BACKGROUNDS = REPO / 'src' / 'renderer' / 'assets' / 'ui' / 'backgrounds'
SPRITES = REPO / 'src' / 'renderer' / 'assets' / 'ui' / 'sprites'
CONFIG = json.loads((Path(__file__).parent / 'realms.json').read_text())
BASE_MEAN = 0.17
TAKE = 0.62
WEBP_QUALITY = 84


def ramp(x, lo, hi):
    if hi <= lo:
        return (x >= lo).astype(np.float32)
    return np.clip((x - lo) / (hi - lo), 0, 1)


def soften(mask, radius):
    k = int(radius * 4) | 1
    return cv2.GaussianBlur(mask.astype(np.float32), (k, k), radius)


def region_mask(shape, family, k=1):
    h, w = shape
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    mask = np.zeros(shape, np.float32)
    for x0, y0, x1, y1 in family.get('boxes', []):
        mask = np.maximum(mask, ((u >= x0) & (u <= x1) & (v >= y0) & (v <= y1)).astype(np.float32))
    for e in family.get('ellipses', []):
        d = ((u - e['cx']) / e['rx']) ** 2 + ((v - e['cy']) / e['ry']) ** 2
        mask = np.maximum(mask, (d <= 1).astype(np.float32))
    return soften(mask, 10 * k)


def feather_box(h, w, edge=0.12):
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    fy = np.minimum(yy + 0.5, h - yy - 0.5) / max(1.0, edge * h)
    fx = np.minimum(xx + 0.5, w - xx - 0.5) / max(1.0, edge * w)
    f = np.clip(np.minimum(fx, fy), 0, 1)
    return f * f * (3 - 2 * f)


def families_of(im, config, k=1):
    r, g, b = im[..., 0], im[..., 1], im[..., 2]
    mx, mn = im.max(-1), im.min(-1)
    d = mx - mn + 1e-6
    hue = np.where(mx == r, ((g - b) / d) % 6, np.where(mx == g, (b - r) / d + 2, (r - g) / d + 4)) / 6
    sat = d / (mx + 1e-6)
    lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
    claimed = np.zeros(im.shape[:2], np.float32)
    out = {}
    for family in config['families']:
        if family['hue'] is None:
            tint = (1 - ramp(sat, 0.25, 0.5)) * ramp(mx, family["val"][0], family["val"][1])
        else:
            h0, h1 = family['hue']
            band = ((hue >= h0) & (hue <= h1)) if h0 < h1 else ((hue >= h0) | (hue <= h1))
            tint = band * ramp(sat, family['sat'][0], family['sat'][1]) * ramp(mx, family['val'][0], family['val'][1])
        light = np.maximum(tint, ramp(lum, 0.7, 0.92)) if family.get('hot') else tint
        light = np.clip(soften(light, 2.0 * k) * 1.3, 0, 1) * region_mask(im.shape[:2], family, k)
        # Each pixel's light belongs to the first family that claims it: no light added twice.
        light = np.minimum(light, 1 - claimed)
        claimed += light
        out[family['name']] = light
    return out, claimed


def warp(img, dx, dy):
    h, w = img.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    dx = np.broadcast_to(np.asarray(dx, np.float32), (h, w))
    dy = np.broadcast_to(np.asarray(dy, np.float32), (h, w))
    return cv2.remap(img, xx + dx, yy + dy, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REFLECT)


def animate(kind, crop, tau, region):
    """One frame (tau in 0..1 over the loop) of a region: (rgb, alpha) both float, alpha 0..1."""
    h, w = crop.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    u, v = xx / w, yy / h
    two_pi = 2 * np.pi
    rgb, alpha = crop[..., :3], crop[..., 3]
    if kind == 'flow':
        # Two copies scrolling the same way half a period apart, each faded out as it wraps: no seam.
        around = region.get('direction') == 'around'
        length = (0.5 if around else 0.35) * (w if around else h)
        frames = []
        for offset in (0.0, 0.5):
            p = (tau + offset) % 1.0
            weight = 1 - abs(2 * p - 1)
            wobble = 1.2 * np.sin(two_pi * (v * 3 + u * 2 + tau))
            if around:
                frames.append((warp(crop, -p * length + wobble * 0, wobble), weight))
            else:
                frames.append((warp(crop, wobble, -p * length), weight))
        total = sum(weight for _, weight in frames) + 1e-6
        blended = sum(f * weight for f, weight in frames) / total
        # The crack stays where it is; what runs is the molten light inside it: the scrolled copy's
        # brightness modulates the seam's own, so bright clots travel down a channel that holds still.
        moving = (blended[..., :3].mean(-1) * blended[..., 3])
        still = (rgb.mean(-1) * alpha)
        level = moving / (np.percentile(still[alpha > 0.2], 75) + 1e-4) if (alpha > 0.2).any() else moving
        pulse = 0.82 + 0.28 * np.sin(two_pi * ((u if around else v) * 2.5 - tau * 2))
        return rgb * (0.75 + 0.35 * np.clip(level, 0, 1.6))[..., None], np.clip(alpha * (0.45 + 0.75 * np.clip(level, 0, 1.4)) * pulse, 0, 1)
    if kind == 'flame':
        rise = 1 - v
        dx = rise ** 1.5 * (2.2 * np.sin(two_pi * (v * 2.2 - tau * 3)) + 1.2 * np.sin(two_pi * (v * 5 + u * 2 - tau * 5)))
        dy = rise * (1.5 + 1.5 * np.sin(two_pi * (tau * 2 + u)))
        moved = warp(crop, dx * (w / 40), dy * (h / 40))
        flicker = 0.8 + 0.2 * np.sin(two_pi * tau * 4) * np.sin(two_pi * (tau * 3 + 0.3))
        return moved[..., :3], np.clip(moved[..., 3] * flicker, 0, 1)
    if kind == 'ripple':
        dx = 1.6 * np.sin(two_pi * (v * 9 + tau)) + 0.9 * np.sin(two_pi * (v * 17 - u * 3 - tau * 2))
        dy = 0.6 * np.sin(two_pi * (u * 6 + tau * 2))
        moved = warp(crop, dx * (1 + 2 * v), dy * (1 + 2 * v))
        glint = 0.85 + 0.25 * np.sin(two_pi * (u * 14 + v * 9 - tau * 2)) * np.sin(two_pi * (v * 11 + tau))
        return moved[..., :3], np.clip(moved[..., 3] * glint, 0, 1)
    if kind == 'billow':
        dx = 3.5 * np.sin(two_pi * (v * 2 + tau) + 2 * np.sin(two_pi * (u * 1.5 - tau))) + 1.5 * np.sin(two_pi * (u * 4 + v * 3 + tau * 2))
        dy = 2.5 * np.cos(two_pi * (u * 2 - tau) + 2 * np.cos(two_pi * (v * 1.7 + tau))) + 1.0 * np.cos(two_pi * (u * 3 - v * 5 - tau * 2))
        moved = warp(crop, dx, dy)
        return moved[..., :3], moved[..., 3]
    if kind == 'sway':
        anchored = v if region.get('anchor', 'top') == 'top' else 1 - v
        weight = anchored ** 1.6
        gust = np.sin(two_pi * (tau + u * 0.6)) + 0.35 * np.sin(two_pi * (tau * 2 + v * 1.3))
        moved = warp(crop, -weight * 3.2 * gust, -weight * 0.6 * np.cos(two_pi * tau))
        return moved[..., :3], moved[..., 3]
    if kind == 'shimmer':
        # A band of light running up the ice, leaving at the top as the next comes in at the bottom.
        position = 1.25 - 1.5 * tau
        band = np.exp(-(((v + 0.3 * u) - position) ** 2) / 0.012) + np.exp(-(((v + 0.3 * u) - position - 1.5) ** 2) / 0.012)
        return rgb, np.clip(alpha * (0.75 + 0.9 * band), 0, 1)
    if kind == 'rays':
        streaks = 0.5 + 0.5 * np.sin(two_pi * (u * 7 + 0.3 * np.sin(two_pi * u * 3))) * np.sin(two_pi * (u * 13 + 0.5))
        fall = 0.5 + 0.5 * np.sin(two_pi * (v * 3 - tau * 2) + u * 4)
        return rgb, np.clip(alpha * (0.55 + 0.7 * streaks * fall), 0, 1)
    raise ValueError(kind)


def rgba_image(rgb, alpha):
    px = np.concatenate([np.clip(rgb, 0, 1), np.clip(alpha, 0, 1)[..., None]], axis=-1)
    return Image.fromarray((px * 255 + 0.5).astype(np.uint8), 'RGBA')


def webp(png, quality=WEBP_QUALITY):
    out = png.with_suffix('.webp')
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', str(png), '-c:v', 'libwebp', '-quality', str(quality), '-compression_level', '6', str(out)], check=True)
    return out


def build(realm, check_dir, k=1):
    config = CONFIG[realm]
    prefix = f'bg-gameplay-realm-{realm}-v1'
    source = BACKGROUNDS / (f'{prefix}-2x.png' if k == 2 else f'{prefix}.png')
    plate = np.asarray(Image.open(source).convert('RGB')).astype(np.float32) / 255
    H, W, _ = plate.shape
    lights, claimed = families_of(plate, config, k)
    base = plate * (1 - TAKE * claimed[..., None])
    lum = float((0.2126 * base[..., 0] + 0.7152 * base[..., 1] + 0.0722 * base[..., 2]).mean())
    base *= min(1.0, BASE_MEAN / lum)
    glow_rgb = plate * 1.1
    # Cut each animated family region out of its static layer, so the moving light is the only light there.
    cut = {name: np.ones((H, W), np.float32) for name in lights}
    for region in config['regions']:
        if region['source'].startswith('family:'):
            x0, y0, x1, y1 = region['box']
            px0, py0, px1, py1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
            cut[region['source'][7:]][py0:py1, px0:px1] *= 1 - feather_box(py1 - py0, px1 - px0)
    Image.fromarray((np.clip(base, 0, 1) * 255 + 0.5).astype(np.uint8)).save(BACKGROUNDS / f'{prefix}-base.png')
    webp(BACKGROUNDS / f'{prefix}-base.png')
    for name, light in lights.items():
        path = BACKGROUNDS / f'{prefix}-glow-{name}.png'
        image = rgba_image(glow_rgb, light * cut[name])
        if k != 1:
            image = image.resize((W // k, H // k), Image.LANCZOS)
        image.save(path)
        webp(path)
    # The moving parts.
    manifest = {'plate': [W, H], 'kind': 'realm', 'sprites': []}
    previews = {}
    for region in config['regions']:
        x0, y0, x1, y1 = region['box']
        px0, py0, px1, py1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
        if region['source'] == 'plate':
            crop_rgb = base[py0:py1, px0:px1]
            crop_alpha = np.ones(crop_rgb.shape[:2], np.float32)
        else:
            crop_rgb = glow_rgb[py0:py1, px0:px1]
            crop_alpha = lights[region['source'][7:]][py0:py1, px0:px1]
        crop = np.dstack([crop_rgb, crop_alpha]).astype(np.float32)
        scale = region.get('scale', 1.0) / k
        if scale != 1.0:
            crop = cv2.resize(crop, (max(2, int(crop.shape[1] * scale)), max(2, int(crop.shape[0] * scale))), interpolation=cv2.INTER_AREA)
        fh, fw = crop.shape[:2]
        frames = region['frames']
        if fw * frames > 16383:
            raise SystemExit(f'{realm}/{region["id"]}: strip {fw * frames}px wide is past WebP\'s limit; lower its scale or frames')
        edge = feather_box(fh, fw)
        tiles = []
        for k in range(frames):
            tau = (k / frames + region.get('phase', 0.0)) % 1.0
            rgb, alpha = animate(region['kind'], crop, tau, region)
            tiles.append(np.dstack([rgb, alpha * edge]))
        strip = np.concatenate(tiles, axis=1)
        name = f'{prefix}-sprite-{region["id"]}'
        png = SPRITES / f'{name}.png'
        rgba_image(strip[..., :3], strip[..., 3]).save(png)
        sheet = webp(png, 82)
        previews[region['id']] = tiles
        manifest['sprites'].append({
            'id': region['id'],
            'x': round(x0, 5), 'y': round(y0, 5), 'w': round(x1 - x0, 5), 'h': round(y1 - y0, 5),
            'frames': frames, 'fps': region['fps'], 'sheet': sheet.name,
            'source': region['source'], 'blend': 'source-over' if region['source'] == 'plate' else 'lighter',
        })
        print(f'  {realm}/{region["id"]}: {region["kind"]} {fw}x{fh} x{frames} -> {sheet.stat().st_size // 1024} KB')
    (SPRITES / f'{prefix}-sprites.json').write_text(json.dumps(manifest, indent=2) + '\n')
    if check_dir:
        check(realm, base, glow_rgb, lights, cut, config, previews, check_dir)
    print(f'{realm}: families ' + ', '.join(f'{n} {float((l > 0.5).mean()) * 100:.1f}%' for n, l in lights.items()))


def check(realm, base, glow_rgb, lights, cut, config, previews, check_dir):
    """The room put back together as the game will: an animated GIF a loop long, at a warm combo."""
    out = Path(check_dir)
    out.mkdir(parents=True, exist_ok=True)
    H, W, _ = base.shape
    frames = []
    for k in range(24):
        img = base.copy()
        tau = k / 24
        for region in config['regions']:
            tiles = previews[region['id']]
            tile = tiles[int(tau * len(tiles)) % len(tiles)]
            x0, y0, x1, y1 = region['box']
            px0, py0, px1, py1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
            big = cv2.resize(tile, (px1 - px0, py1 - py0), interpolation=cv2.INTER_LINEAR)
            if region['source'] == 'plate':
                a = big[..., 3:4]
                img[py0:py1, px0:px1] = img[py0:py1, px0:px1] * (1 - a) + big[..., :3] * a
        light = sum(glow_rgb * (lights[n] * cut[n])[..., None] * 0.7 for n in lights)
        img = img + light
        for region in config['regions']:
            if region['source'] != 'plate':
                tiles = previews[region['id']]
                tile = tiles[int(tau * len(tiles)) % len(tiles)]
                x0, y0, x1, y1 = region['box']
                px0, py0, px1, py1 = int(x0 * W), int(y0 * H), int(x1 * W), int(y1 * H)
                big = cv2.resize(tile, (px1 - px0, py1 - py0), interpolation=cv2.INTER_LINEAR)
                img[py0:py1, px0:px1] += big[..., :3] * big[..., 3:4] * 0.7
        frames.append(Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).resize((W // 2, H // 2), Image.LANCZOS))
    frames[0].save(out / f'{realm}-room.gif', save_all=True, append_images=frames[1:], duration=110, loop=0)
    sheet = np.concatenate([np.clip(base, 0, 1)] + [np.clip(glow_rgb * (lights[n] * cut[n])[..., None], 0, 1) for n in lights], axis=1)
    Image.fromarray((sheet * 255).astype(np.uint8)).resize((sheet.shape[1] // 3, H // 3), Image.LANCZOS).save(out / f'{realm}-layers.png')


ap = argparse.ArgumentParser()
ap.add_argument('realms', nargs='*', default=list(k for k in CONFIG if not k.startswith('$')))
ap.add_argument('--check-dir', default=None)
ap.add_argument('--scale', type=int, default=1, choices=[1, 2])
args = ap.parse_args()
for realm in args.realms:
    build(realm, args.check_dir, args.scale)
