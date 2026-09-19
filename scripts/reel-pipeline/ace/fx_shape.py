"""Shape ACE-Step's generated textures into one-shot effects.

The model renders continuous sound, so each picked take is treated as timbre material: the
segment from its strongest transient is cut out, filtered to the effect's register, and given the
envelope the on-screen event needs. Output: one 48 kHz mono WAV per kind, peak -1 dBFS.

Usage: python fx_shape.py <picked dir with picks.json> <shaped dir>
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
import soundfile as sf

SR = 48000


def onepole_lp(x, cutoff, passes=2):
    a = math.exp(-2 * math.pi * cutoff / SR)
    for _ in range(passes):
        y = np.empty_like(x); acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def highpass(x, cutoff):
    return x - onepole_lp(x, cutoff, passes=1)


def decay(n, tau):
    return np.exp(-np.arange(n) / (SR * tau))


def swell(n, power=1.6):
    return np.sin(np.pi * np.arange(n) / n) ** power


def ramp_up(n, power=2.2):
    return (np.arange(n) / n) ** power


SHAPES = {
    # kind: (length s, envelope, highpass Hz, lowpass Hz, extra)
    'fx-card-flip':   (0.26, lambda n: decay(n, 0.045) * (1 - decay(n, 0.0015)), 400, 12000),
    'fx-card-whoosh': (1.10, lambda n: swell(n, 1.4), 120, 9000),
    'fx-reveal':      (1.90, lambda n: (1 - decay(n, 0.004)) * decay(n, 0.55), 500, 16000),
    'fx-match':       (1.60, lambda n: (1 - decay(n, 0.004)) * decay(n, 0.45), 400, 16000),
    'fx-clump-pop':   (1.30, lambda n: (1 - decay(n, 0.002)) * (0.75 * decay(n, 0.12) + 0.25 * decay(n, 0.5)), 60, 14000),
    'fx-floor-clear': (3.50, lambda n: np.concatenate([np.ones(n - int(0.8 * SR)), np.linspace(1, 0, int(0.8 * SR))]), 80, 16000),
    'fx-riser':       (1.90, lambda n: ramp_up(n, 2.4), 200, 12000),
    'fx-logo-boom':   (2.60, lambda n: (1 - decay(n, 0.003)) * decay(n, 0.75), 30, 1200),
}

src, dst = Path(sys.argv[1]), Path(sys.argv[2])
dst.mkdir(parents=True, exist_ok=True)
picks = json.load(open(src / 'picks.json'))
for kind, (length, env_fn, hp, lp) in SHAPES.items():
    p = picks[kind]
    take = Path(p['file'])
    if not take.is_absolute():
        take = src / take   # frozen picks name the take next to picks.json
    y, sr = sf.read(take, always_2d=True)
    if sr != SR:
        raise SystemExit(f'{kind}: {sr} Hz')
    mono = y.mean(axis=1)
    n = int(length * SR)
    if kind == 'fx-riser':
        # The riser ends on the transient: take the material *before* the onset and ramp into it.
        end = int(p['t_on'] * SR) + int(0.05 * SR)
        start = max(0, end - n)
    else:
        start = max(0, int(p['t_on'] * SR) - int(0.004 * SR))
        end = start + n
    seg = mono[start:end]
    if len(seg) < n:
        seg = np.concatenate([seg, np.zeros(n - len(seg))])
    seg = highpass(seg, hp)
    seg = onepole_lp(seg, lp)
    if kind == 'fx-logo-boom':
        # Add the sub the caption asked for underneath the model's (broadband) hit.
        t = np.arange(n) / SR
        f = 42 * (1 + 0.5 * np.exp(-t / 0.06))
        seg = seg / (np.max(np.abs(seg)) + 1e-9) * 0.6 + np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9)
    if kind == 'fx-clump-pop':
        t = np.arange(n) / SR
        f = 170 * np.exp(-t / 0.08) + 50
        seg = seg / (np.max(np.abs(seg)) + 1e-9) * 0.8 + np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.14) * 0.7
    out = seg * env_fn(n)
    fo = int(0.02 * SR)
    out[-fo:] *= np.linspace(1, 0, fo)
    out = out / (np.max(np.abs(out)) + 1e-9) * (10 ** (-1 / 20))
    sf.write(dst / f'{kind}.wav', out.astype(np.float32), SR, subtype='PCM_24')
    print(f'{kind:16s} {length:4.2f}s  from {Path(p["file"]).parent.name} @ {p["t_on"]:.2f}s')
