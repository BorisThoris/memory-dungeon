#!/usr/bin/env python3
"""
Turn an ACE-Step render into a seamless, level-matched loop WAV.

ACE-Step text2music renders start cold and fade out at the end, so a straight `-t 30` trim
clicks or dips at the loop seam. This script drops the intro/outro, then crossfades the tail
back over the head (equal-power) so the file loops without a seam, and finally scales it to a
target RMS with a peak ceiling.

  .venv-audio\\Scripts\\python.exe scripts/audio-pipeline/make-seamless-loop.py ^
      --input tmp/audio/ace-step-ambience/demo-ambience-loop/<take>.flac ^
      --output assets/audio/portfolio-feedback-pack/demo-ambience-loop.wav ^
      --skip-head 1.0 --skip-tail 3.0 --crossfade 2.0 --target-rms-db -24 --peak-db -3
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
import soundfile as sf


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Seamless loop + level match for an ACE-Step render.")
    p.add_argument("--input", type=Path, required=True)
    p.add_argument("--output", type=Path, required=True)
    p.add_argument("--skip-head", type=float, default=1.0, help="Seconds dropped from the start (cold open).")
    p.add_argument("--skip-tail", type=float, default=3.0, help="Seconds dropped from the end (fade-out).")
    p.add_argument("--crossfade", type=float, default=2.0, help="Seconds of tail folded over the head.")
    p.add_argument("--target-rms-db", type=float, default=-24.0, help="Overall RMS target in dBFS.")
    p.add_argument("--peak-db", type=float, default=-3.0, help="Peak ceiling in dBFS (limits the RMS gain).")
    p.add_argument("--sample-rate", type=int, default=None, help="Resample output (default: keep input rate).")
    p.add_argument("--subtype", default="PCM_16")
    return p.parse_args()


def db_to_lin(db: float) -> float:
    return float(10 ** (db / 20))


def main() -> None:
    args = parse_args()
    data, sr = sf.read(str(args.input), always_2d=True, dtype="float64")
    n_head = int(args.skip_head * sr)
    n_tail = int(args.skip_tail * sr)
    body = data[n_head : len(data) - n_tail]
    n_fade = int(args.crossfade * sr)
    if n_fade <= 0 or len(body) <= 2 * n_fade:
        raise SystemExit("Render too short for the requested skip/crossfade window.")

    head = body[:n_fade]
    tail = body[-n_fade:]
    t = np.linspace(0.0, 1.0, n_fade, endpoint=False)[:, None]
    fade_in = np.sin(0.5 * np.pi * t)
    fade_out = np.cos(0.5 * np.pi * t)
    seam = head * fade_in + tail * fade_out
    looped = np.concatenate([seam, body[n_fade:-n_fade]], axis=0)

    rms = float(np.sqrt(np.mean(looped**2)))
    gain = db_to_lin(args.target_rms_db) / max(rms, 1e-9)
    peak = float(np.max(np.abs(looped)))
    peak_gain = db_to_lin(args.peak_db) / max(peak, 1e-9)
    gain = min(gain, peak_gain)
    looped *= gain

    if args.sample_rate and args.sample_rate != sr:
        import math  # noqa: PLC0415

        ratio = args.sample_rate / sr
        n_out = int(math.floor(len(looped) * ratio))
        x_old = np.arange(len(looped))
        x_new = np.arange(n_out) / ratio
        looped = np.stack([np.interp(x_new, x_old, looped[:, c]) for c in range(looped.shape[1])], axis=1)
        sr = args.sample_rate

    args.output.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(args.output), looped, sr, subtype=args.subtype)
    out_rms = 20 * np.log10(max(float(np.sqrt(np.mean(looped**2))), 1e-9))
    out_peak = 20 * np.log10(max(float(np.max(np.abs(looped))), 1e-9))
    print(
        f"wrote {args.output} ({len(looped) / sr:.2f}s @ {sr} Hz, rms {out_rms:.1f} dBFS, peak {out_peak:.1f} dBFS, "
        f"seam crossfade {args.crossfade:.1f}s)"
    )


if __name__ == "__main__":
    main()
