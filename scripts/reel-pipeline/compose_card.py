"""Composite a generated face illustration under the card's gold frame.

Usage: py -3.12 compose_card.py <front.png> <face.png> <out.png>
The frame's gold and gems are keyed by luminance (the inset is dark stone), blurred a little so
the ornaments feather over the art; the art itself has the same midnight void at its edges.
"""
import sys
from PIL import Image, ImageFilter
import numpy as np

front_path, face_path, out_path = sys.argv[1:4]
frame = Image.open(front_path).convert('RGB')
W, H = frame.size
face = Image.open(face_path).convert('RGB')

# The arch window, as fractions of the card: sides 0.16..0.84, top 0.10, bottom 0.90.
win = (int(W * 0.13), int(H * 0.085), int(W * 0.87), int(H * 0.915))
ww, wh = win[2] - win[0], win[3] - win[1]
# Cover-fit the face into the window, crop 6% inset first (Z-Image paints a thin edge frame).
fw, fh = face.size
face = face.crop((int(fw * 0.06), int(fh * 0.06), int(fw * 0.94), int(fh * 0.94)))
fw, fh = face.size
scale = max(ww / fw, wh / fh)
face = face.resize((int(fw * scale) + 1, int(fh * scale) + 1), Image.LANCZOS)
fx = (face.size[0] - ww) // 2
fy = (face.size[1] - wh) // 2
face = face.crop((fx, fy, fx + ww, fy + wh))

canvas = frame.copy()
canvas.paste(face, (win[0], win[1]))

# Frame mask: bright warm (gold) and bright cool (gems) pixels of the original frame.
arr = np.asarray(frame).astype(np.float32)
lum = arr.mean(axis=2)
sat = arr.max(axis=2) - arr.min(axis=2)
m = np.clip((lum - 62) / 40, 0, 1)
m = np.maximum(m, np.clip((sat - 70) / 40, 0, 1))
mask = Image.fromarray((m * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))
# Outside the window the frame always wins.
outside = Image.new('L', (W, H), 255)
outside.paste(0, win)
mask = Image.fromarray(np.maximum(np.asarray(mask), np.asarray(outside)))

out = Image.composite(frame, canvas, mask)
out.save(out_path)
print('composited', out_path)
