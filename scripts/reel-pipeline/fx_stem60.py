"""Positional SFX stem for the 60 fps cut, driven by edit60's timeline.json (frame-exact events).

Usage: python fx_stem60.py <shaped fx dir> <pos-board.json> <timeline.json> <out.wav>
"""
import json
import math
import sys
import numpy as np
import soundfile as sf

SR = 48000
DUR = 10.0
rng = np.random.default_rng(11)
stem = np.zeros((int(SR * DUR), 2))
cues = []
# Peak dBFS per kind. Re-balanced against the score (v6c): measured per 0.25 s, the flips and the
# floor-clear sat 9-15 dB under the music and were inaudible, the logo boom sat 6 dB over it.
LEVEL = {
    'fx-card-flip': -8.0, 'fx-card-whoosh': -9.0, 'fx-reveal': -7.0, 'fx-match': -6.0,
    'fx-clump-pop': -3.0, 'fx-floor-clear': -4.0, 'fx-riser': -11.0, 'fx-logo-boom': -8.0,
}
lib = {}
for kind in LEVEL:
    y, sr = sf.read(f'{sys.argv[1]}/{kind}.wav', always_2d=True)
    lib[kind] = y.mean(axis=1)


def pitch(y, st):
    if abs(st) < 0.01:
        return y
    n = int(len(y) / 2 ** (st / 12))
    return np.interp(np.linspace(0, len(y) - 1, n), np.arange(len(y)), y)


def lowpass(x, cutoff):
    a = math.exp(-2 * math.pi * cutoff / SR)
    out = np.empty_like(x); acc = 0.0
    for i in range(len(x)):
        acc = (1 - a) * x[i] + a * acc
        out[i] = acc
    return out


def place(kind, t, x, gain_db=0.0, semitones=0.0, far=0.0, label=''):
    y = pitch(lib[kind], semitones)
    if far > 0:
        y = lowpass(y, 9000 - 6000 * far)
    level = LEVEL[kind] + gain_db - 4.5 * far
    y = y / (np.max(np.abs(y)) + 1e-9) * (10 ** (level / 20))
    pan = max(-1.0, min(1.0, (x - 0.5) * 2.0)) * 0.85
    theta = (pan + 1) / 2 * math.pi / 2
    start = int(t * SR); end = min(len(stem), start + len(y))
    seg = y[:end - start]
    stem[start:end, 0] += seg * math.cos(theta)
    stem[start:end, 1] += seg * math.sin(theta)
    cues.append({'t': round(t, 3), 'kind': kind, 'pan': round(pan, 2), 'level_db': round(level, 1), 'label': label})


pos_board = json.load(open(sys.argv[2]))
plan = json.load(open(sys.argv[3]))

# Hero (0-1.8) and board (1.8-4.0) are the Blender shots: same timing as the 30 fps keys.
place('fx-riser', 0.05, 0.5, gain_db=-2, label='hero: tension into the turn')
place('fx-card-whoosh', 0.30, 0.5, label='hero: the card turns')
place('fx-card-flip', 0.72, 0.5, gain_db=-2, semitones=-2, label='hero: edge-on snap')
place('fx-reveal', 1.08, 0.5, label='hero: the face lands')
by_card = {}
for r in pos_board:
    by_card.setdefault(r['card'], []).append(r)
ticks = []
for name, rows in by_card.items():
    rows.sort(key=lambda r: r['frame'])
    flips = [r for r in rows if r['frame'] not in (1, 66)]
    if len(flips) < 2:
        continue
    f0, f1 = flips[0], flips[1]
    ticks.append((1.8 + (f0['frame'] + 7) / 30, (f0['x'] + f1['x']) / 2, (f0['y'] + f1['y']) / 2, name))
ticks.sort()
for t, x, y, name in ticks:
    on = 0.0 <= x <= 1.0
    far = max(0.0, min(1.0, (y - 0.35) / 0.5))
    place('fx-card-flip', t, min(1, max(0, x)), gain_db=(-2.5 if on else -12), semitones=rng.uniform(-1.5, 1.5), far=far, label=f'board: {name} turns')
lift = {r['card']: r for r in pos_board if r['frame'] == 66 and r['card'] in ('card_4', 'card_7')}
place('fx-match', 3.58, (lift['card_4']['x'] + lift['card_7']['x']) / 2, label='board: the pair lifts')

# Gameplay, colophon and end card from the frame-exact plan.
for e in plan['events']:
    st = rng.uniform(-1, 1) if e['kind'] == 'fx-card-flip' else 0.0
    place(e['kind'], e['t'], e['x'], semitones=st, label=e['label'])

peak = np.max(np.abs(stem))
if peak > 0.98:
    stem *= 0.98 / peak
sf.write(sys.argv[4], stem.astype(np.float32), SR, subtype='PCM_24')
json.dump(cues, open(sys.argv[4].rsplit('.', 1)[0] + '-cues.json', 'w'), indent=2)
print(f'stem: {len(cues)} cues, peak {peak:.2f}')
