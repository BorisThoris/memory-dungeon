# Mastering report: waveform + spectrogram + momentary loudness of the premaster mix vs the master,
# with the per-0.5 s peak / crest table.  python report.py <mix.wav> <master.wav> <out.png> [title]
import subprocess, sys, json, re, numpy as np
from PIL import Image, ImageDraw, ImageFont
mix, master, out = sys.argv[1:4]; title = sys.argv[4] if len(sys.argv) > 4 else 'Mastering report'
W, H = 1400, 300
def pcm(f):
    r = subprocess.run(['ffmpeg', '-v', 'error', '-i', f, '-f', 'f32le', '-ac', '2', '-ar', '48000', '-'], capture_output=True)
    return np.frombuffer(r.stdout, dtype=np.float32).reshape(-1, 2)
def spec(f, png):
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', f, '-lavfi', f'showspectrumpic=s={W}x{H}:legend=0:scale=log:color=fire', png], check=True)
def momentary(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=none', '-f', 'null', '-'], capture_output=True, text=True)
    pts = [(float(a), float(b)) for a, b in re.findall(r't:\s*([0-9.]+)\s.*?M:\s*(-?[0-9.]+)', r.stderr)]
    return pts
def stats(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    g = lambda k: re.search(k + r':\s*(-?[0-9.]+)', r.split('Summary')[-1]).group(1)
    return f"I {g('I')} LUFS  LRA {g('LRA')} LU  TP {g('Peak')} dBTP"
def crest_table(f):
    x = pcm(f); a = np.abs(x).max(axis=1); rows = []
    for i in range(0, len(a), 24000):
        s = x[i:i+24000]; pk = 20*np.log10(max(np.abs(s).max(), 1e-9)); rms = 20*np.log10(max(np.sqrt((s**2).mean()), 1e-9))
        rows.append((i/48000, pk, pk-rms))
    return rows
font = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 18); small = ImageFont.truetype('C:/Windows/Fonts/consola.ttf', 14)
rowsH = 30
img = Image.new('RGB', (W + 40, 60 + 2*(H + 90) + 260 + rowsH*3), (16, 16, 20)); d = ImageDraw.Draw(img)
d.text((20, 18), title, fill=(240, 235, 220), font=font)
y = 60
for label, f in (('premaster mix', mix), ('master', master)):
    spec(f, out + '.spec.png'); img.paste(Image.open(out + '.spec.png'), (20, y + 24))
    d.text((20, y), f'{label}: {stats(f)}', fill=(200, 200, 200), font=font)
    x = pcm(f); a = np.abs(x).max(axis=1); n = W; seg = len(a)//n
    env = a[:seg*n].reshape(n, seg).max(axis=1)
    for i, v in enumerate(env):
        h = int(v * 60); d.line((20+i, y+24+H+62-h, 20+i, y+24+H+62+h), fill=(230, 150, 60) if v > 0.85 else (120, 160, 220))
    y += H + 90 + 60
# momentary loudness curves
d.text((20, y), 'momentary loudness (0.4 s window): grey = mix, gold = master   (-8 … -30 LUFS)', fill=(200, 200, 200), font=font); y += 26
d.rectangle((20, y, 20+W, y+180), outline=(60, 60, 70))
for f, col in ((mix, (110, 110, 120)), (master, (235, 190, 90))):
    pts = [(20 + t/10*W, y + (-8 - m)/22*180) for t, m in momentary(f) if -30 <= m <= -8 and t <= 10]
    if len(pts) > 1: d.line(pts, fill=col, width=2)
for s in range(0, 11): d.text((20 + s/10*W - 4, y+184), str(s), fill=(140, 140, 150), font=small)
y += 210
rows = crest_table(master)
d.text((20, y), 'master per 0.5 s  peak dBFS / crest dB:', fill=(200, 200, 200), font=font); y += 24
line = '  '.join(f'{t:4.1f}s {pk:5.1f}/{cr:4.1f}' for t, pk, cr in rows)
for i in range(0, len(rows), 7):
    d.text((20, y), '  '.join(f'{t:4.1f}s {pk:5.1f}/{cr:4.1f}' for t, pk, cr in rows[i:i+7]), fill=(180, 200, 180), font=small); y += 20
img.save(out); print('report written')
