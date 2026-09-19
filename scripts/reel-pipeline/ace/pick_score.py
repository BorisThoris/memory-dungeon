"""Rank ACE-Step score candidates against the reel's cut and print the alignment offset for each.

The cut wants: a big impact at 4.70 s (the Sharp break), energy sustained through the colophon
(6.6-8.0 s), the end card from 8.0 s, silence or a tail by 10 s. For every candidate we detect
onsets (spectral-flux novelty), take the strongest onset in the first 7 s as "the hit", compute
the offset that puts it on 4.70 s, and score how well the rest of the envelope fits once shifted.

Usage: python pick_score.py <dir-with-wavs> [more dirs...]
"""
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

HIT_AT = 4.70
SR_HOP = 0.02


def analyse(path: Path):
    y, sr = sf.read(path, always_2d=True)
    y = y.mean(axis=1)
    hop = int(sr * SR_HOP)
    win = hop * 4
    n = (len(y) - win) // hop
    frames = np.stack([y[i * hop:i * hop + win] for i in range(n)])
    window = np.hanning(win)
    spec = np.abs(np.fft.rfft(frames * window, axis=1))
    logspec = np.log1p(spec)
    flux = np.maximum(logspec[1:] - logspec[:-1], 0).sum(axis=1)
    flux = np.concatenate([[0], flux])
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    rms_db = 20 * np.log10(rms + 1e-9)
    t = np.arange(n) * SR_HOP
    return t, flux, rms_db, len(y) / sr


def score(path: Path):
    t, flux, rms_db, dur = analyse(path)
    # Strongest novelty in [1.5, 7.5] s is the hit; require some quiet before it.
    lo, hi = np.searchsorted(t, 1.5), np.searchsorted(t, 7.5)
    i_hit = lo + int(np.argmax(flux[lo:hi]))
    t_hit = t[i_hit]
    offset = HIT_AT - t_hit  # positive: delay the music; negative: trim its head
    # Evaluate the shifted envelope on the reel timeline.
    def level(a, b):
        ia, ib = np.searchsorted(t, a - offset), np.searchsorted(t, b - offset)
        ia, ib = max(0, ia), min(len(t), ib)
        return float(np.mean(rms_db[ia:ib])) if ib > ia else -90.0
    pre = level(0.0, 4.4)          # build, should be quieter than the body
    body = level(4.9, 8.0)         # the break and the colophon
    tail = level(8.6, 10.0)        # under the end card
    contrast = body - pre
    hit_strength = float(flux[i_hit] / (np.median(flux[lo:hi]) + 1e-9))
    # Penalise a hit so early that trimming would drop the intro, or silence inside the body.
    head_ok = 0.0 if offset >= -1.5 else (offset + 1.5) * 4
    ia, ib = np.searchsorted(t, 4.9 - offset), np.searchsorted(t, 8.0 - offset)
    gaps = float(np.mean(rms_db[ia:ib] < -40)) if ib > ia else 1.0
    fit = contrast * 1.2 + min(hit_strength, 12) * 1.0 + (body + 20) * 0.6 - gaps * 30 + head_ok
    return {
        'file': str(path), 'dur': round(dur, 2), 't_hit': round(float(t_hit), 2), 'offset': round(float(offset), 2),
        'pre_db': round(pre, 1), 'body_db': round(body, 1), 'tail_db': round(tail, 1), 'contrast': round(contrast, 1),
        'hit_strength': round(hit_strength, 1), 'gaps': round(gaps, 2), 'fit': round(float(fit), 1)
    }


rows = []
for d in sys.argv[1:]:
    for p in sorted(Path(d).rglob('*.wav')) + sorted(Path(d).rglob('*.flac')):
        rows.append(score(p))
rows.sort(key=lambda r: -r['fit'])
for r in rows:
    print(f"{r['fit']:6.1f}  hit@{r['t_hit']:5.2f} off={r['offset']:+5.2f}  pre {r['pre_db']:6.1f} body {r['body_db']:6.1f} tail {r['tail_db']:6.1f}  contrast {r['contrast']:5.1f} hit x{r['hit_strength']:4.1f} gaps {r['gaps']:.2f}  {Path(r['file']).parent.name}/{Path(r['file']).name}")
