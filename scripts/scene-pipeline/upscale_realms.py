"""The realm rooms' paintings at twice their size, for phones and big screens (2026-10-09).

A phone held upright shows the middle quarter of a room's painting across its whole height: from a
1376-pixel painting that was 355 pixels stretched over 1170 device pixels, and the room went soft
while the cards stayed sharp. This writes each painting at 2752x1536 through Real-ESRGAN x4 (then
Lanczos down), as `bg-gameplay-realm-<realm>-v1-2x.png` beside it; `realm_layers.py --scale 2`
cuts the room's base from it at that size (its lights stay at the painting's size: they are soft).

    E:/avatar-scan/venv/Scripts/python.exe -I scripts/scene-pipeline/upscale_realms.py [realm ...]

Needs the avatar-scan venv (torch, basicsr, realesrgan) and RealESRGAN_x4plus.pth, like upscale_plates.py.
"""
import argparse
from pathlib import Path

import numpy as np
from PIL import Image

REPO = Path(__file__).resolve().parents[2]
BACKGROUNDS = REPO / 'src' / 'renderer' / 'assets' / 'ui' / 'backgrounds'
REALMS = ['frost', 'ember', 'tide', 'storm', 'grove']
TARGET = (2752, 1536)

parser = argparse.ArgumentParser()
parser.add_argument('realms', nargs='*', default=REALMS)
parser.add_argument('--weights', type=Path, default=Path('E:/avatar-scan/models/RealESRGAN_x4plus.pth'))
args = parser.parse_args()

from basicsr.archs.rrdbnet_arch import RRDBNet  # noqa: E402
from realesrgan import RealESRGANer  # noqa: E402

model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
net = RealESRGANer(scale=4, model_path=str(args.weights), model=model, tile=512, tile_pad=16, pre_pad=0, half=True, gpu_id=0)
for realm in args.realms:
    source = BACKGROUNDS / f'bg-gameplay-realm-{realm}-v1.png'
    rgb = np.asarray(Image.open(source).convert('RGB'))
    out, _ = net.enhance(np.ascontiguousarray(rgb[:, :, ::-1]), outscale=4)
    big = Image.fromarray(np.ascontiguousarray(out[:, :, ::-1])).resize(TARGET, Image.LANCZOS)
    path = BACKGROUNDS / f'bg-gameplay-realm-{realm}-v1-2x.png'
    big.save(path)
    print('wrote', path.name, big.size)
