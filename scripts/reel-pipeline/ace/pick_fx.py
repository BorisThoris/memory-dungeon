"""Pick the best ACE-Step take per effect kind and trim it to a clean one-shot.

For every take: envelope (2 ms RMS), spectral flux onsets, the main onset, how much energy sits
before it (should be none), whether a second big onset follows (should not, except the riser),
how long the tail takes to fall 40 dB, and the spectral centroid in the first 150 ms after the
onset. Each kind has a target length and brightness; the closest, cleanest take wins and is
written trimmed (start 15 ms before the onset, 3 ms fade in, tail cut at -55 dB or the kind's
maximum length, 40 ms fade out), peak-normalised to -1 dBFS.

Usage: python pick_fx.py <out4 dir> <picked dir>
"""
import json
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

KINDS = {
    #            max_len  want_len  bright(centroid Hz)  second_onset_ok
    'fx-card-flip':   (0.45, 0.15, 3500, False),
    'fx-card-whoosh': (1.40, 1.00, 1500, True),
    'fx-reveal':      (2.20, 1.60, 4000, False),
    'fx-match':       (1.80, 1.20, 3200, True),
    'fx-clump-pop':   (1.60, 1.10, 2200, True),
    'fx-floor-clear': (3.50, 3.00, 1800, True),
    'fx-riser':       (2.40, 2.00, 2500, True),
    'fx-logo-boom':   (3.00, 2.20,  400, False),
}


def analyse(y, sr):
    hop = int(sr * 0.002)
    n = len(y) // hop
    frames = y[:n * hop].reshape(n, hop)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    db = 20 * np.log10(rms + 1e-9)
    # Onsets from a coarser spectral flux (20 ms).
    hop2 = int(sr * 0.02); win = hop2 * 4
    n2 = (len(y) - win) // hop2
    fr2 = np.stack([y[i * hop2:i * hop2 + win] * np.hanning(win) for i in range(n2)])
    spec = np.log1p(np.abs(np.fft.rfft(fr2, axis=1)))
    flux = np.concatenate([[0], np.maximum(spec[1:] - spec[:-1], 0).sum(axis=1)])
    freqs = np.fft.rfftfreq(win, 1 / sr)
    return db, flux, spec, freqs, hop, hop2


def score_take(path, kind):
    max_len, want_len, bright, second_ok = KINDS[kind]
    y, sr = sf.read(path, always_2d=True)
    mono = y.mean(axis=1)
    db, flux, spec, freqs, hop, hop2 = analyse(mono, sr)
    if flux.max() <= 0:
        return None
    i_on = int(np.argmax(flux))
    t_on = i_on * hop2 / sr
    # Energy before the onset (should be silence-ish).
    pre = db[: max(1, int(t_on * sr / hop) - 5)]
    pre_db = float(np.percentile(pre, 90)) if len(pre) > 5 else -90.0
    peak_db = float(db[int(t_on * sr / hop): int(t_on * sr / hop) + int(0.3 * sr / hop)].max())
    # Tail: time after onset until the envelope stays 40 dB under the peak.
    after = db[int(t_on * sr / hop):]
    below = np.where(after < peak_db - 40)[0]
    tail = None
    for k in below:
        if np.all(after[k:k + int(0.15 * sr / hop)] < peak_db - 40):
            tail = k * hop / sr
            break
    if tail is None:
        tail = len(after) * hop / sr
    # A second onset of comparable strength after the tail region starts.
    later = flux[i_on + int(0.25 / 0.02):]
    second = float(later.max() / flux[i_on]) if len(later) else 0.0
    # Brightness just after the onset.
    seg = spec[i_on: i_on + 8]
    mag = np.expm1(seg).mean(axis=0)
    centroid = float((freqs * mag).sum() / (mag.sum() + 1e-9))
    fit = 0.0
    fit -= max(0.0, pre_db - (peak_db - 35)) * 0.5            # noise before the hit
    fit -= abs(np.log(max(tail, 0.05) / want_len)) * 4.0       # length vs the kind's target
    fit -= abs(np.log(max(centroid, 100) / bright)) * 3.0       # brightness vs the kind's target
    if not second_ok:
        fit -= max(0.0, second - 0.45) * 12                    # a second event on a one-shot
    fit -= max(0.0, tail - max_len) * 2.0
    return {
        'file': str(path), 'kind': kind, 't_on': round(t_on, 3), 'pre_db': round(pre_db, 1), 'peak_db': round(peak_db, 1),
        'tail': round(float(tail), 2), 'second': round(second, 2), 'centroid': round(centroid), 'fit': round(fit, 2)
    }


def trim(path, kind, t_on, out_path):
    max_len = KINDS[kind][0]
    y, sr = sf.read(path, always_2d=True)
    start = max(0, int((t_on - 0.015) * sr))
    y = y[start:]
    mono = y.mean(axis=1)
    hop = int(sr * 0.005)
    n = len(mono) // hop
    db = 20 * np.log10(np.sqrt((mono[:n * hop].reshape(n, hop) ** 2).mean(axis=1)) + 1e-9)
    peak = db.max()
    end = n
    for k in range(int(0.1 * sr / hop), n):
        if db[k] < peak - 55 and np.all(db[k:k + int(0.1 * sr / hop)] < peak - 55):
            end = k
            break
    end = min(end * hop, int(max_len * sr), len(y))
    y = y[:end]
    fi, fo = int(0.003 * sr), min(int(0.04 * sr), len(y) // 4)
    y[:fi] *= np.linspace(0, 1, fi)[:, None]
    y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    y = y / (np.max(np.abs(y)) + 1e-9) * (10 ** (-1 / 20))
    sf.write(out_path, y.astype(np.float32), sr, subtype='PCM_24')
    return len(y) / sr


src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
report = {}
for kind in KINDS:
    takes = [score_take(p, kind) for p in sorted((src / kind).rglob('*.wav'))]
    takes = [t for t in takes if t]
    takes.sort(key=lambda t: -t['fit'])
    for t in takes:
        print(f"{kind:16s} fit {t['fit']:6.2f}  on {t['t_on']:5.2f}s  pre {t['pre_db']:6.1f}  tail {t['tail']:4.2f}s  2nd {t['second']:4.2f}  bright {t['centroid']:5d}  {Path(t['file']).parent.name}")
    if takes:
        best = takes[0]
        length = trim(best['file'], kind, best['t_on'], dst / f'{kind}.wav')
        best['trimmed_len'] = round(length, 2)
        report[kind] = best
        print(f"  -> {kind}.wav  {length:.2f}s from {Path(best['file']).parent.name}")
json.dump(report, open(dst / 'picks.json', 'w'), indent=2)
