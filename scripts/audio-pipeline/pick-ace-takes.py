#!/usr/bin/env python3
"""
Score the v##/ takes of an ACE-Step batch with objective cue metrics and write a picks JSON that
install-ace-app-outputs.mjs accepts via --picks (per-job variant override).

One-shots (job duration <= 8 s) are judged inside the install trim window:
  * no clipping, not silent
  * early onset (first sample above -30 dBFS) — a cue should answer the input immediately
  * energy concentrated in the first second (snappy, no long musical tail)
Loops (menu-loop, run-loop, demo-ambience-loop) prefer an even bed:
  * low variance of 1 s RMS windows, no silent gaps, no clipping

  .venv-audio\\Scripts\\python.exe scripts/audio-pipeline/pick-ace-takes.py \
      --ace-out tmp/audio/ace-step --jobs scripts/audio-pipeline/jobs.memory-dungeon-app-audio.json \
      --out tmp/audio/ace-picks.json
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
import soundfile as sf

MEDIA_EXT = {".flac", ".wav", ".mp3", ".ogg", ".opus", ".m4a"}
LOOP_IDS = {"menu-loop", "run-loop", "demo-ambience-loop"}


def db(v: float) -> float:
    return 20 * math.log10(v) if v > 0 else -999.0


def newest_media(folder: Path) -> Path | None:
    files = [p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in MEDIA_EXT] if folder.is_dir() else []
    return max(files, key=lambda p: p.stat().st_mtime) if files else None


def analyze(path: Path, window_s: float, is_loop: bool) -> dict:
    data, sr = sf.read(str(path), always_2d=True, dtype="float64")
    mono = data.mean(axis=1)
    win = mono[: int(window_s * sr)] if not is_loop else mono
    peak = float(np.max(np.abs(win))) if len(win) else 0.0
    rms = float(np.sqrt(np.mean(win**2))) if len(win) else 0.0
    clipped = int(np.sum(np.abs(data) >= 0.999))
    thr = 10 ** (-30 / 20)
    idx = np.where(np.abs(win) > thr)[0]
    onset = float(idx[0] / sr) if len(idx) else float(window_s)
    total_e = float(np.sum(win**2)) or 1e-12
    front_e = float(np.sum(win[: int(1.0 * sr)] ** 2))
    n_win = max(1, int(len(win) / sr))
    frames = [win[i * sr : (i + 1) * sr] for i in range(n_win)]
    frame_rms = np.array([float(np.sqrt(np.mean(f**2))) if len(f) else 0.0 for f in frames])
    silent_frac = float(np.mean(frame_rms < 10 ** (-50 / 20)))
    if rms <= 1e-6:
        score = -1e9
    elif is_loop:
        score = -float(np.std(frame_rms) / max(frame_rms.mean(), 1e-9)) * 4 - silent_frac * 5 - (10 if clipped else 0)
    else:
        score = -onset * 2.0 + (front_e / total_e) * 1.0 - (10 if clipped else 0)
    return {
        "file": str(path),
        "peak_dbfs": round(db(peak), 1),
        "rms_dbfs": round(db(rms), 1),
        "onset_s": round(onset, 3),
        "front_energy": round(front_e / total_e, 3),
        "rms_cv": round(float(np.std(frame_rms) / max(frame_rms.mean(), 1e-9)), 3),
        "silent_frac": round(silent_frac, 3),
        "clipped": clipped,
        "score": round(score, 3),
    }


def main() -> None:
    p = argparse.ArgumentParser(description="Pick ACE-Step takes by objective cue metrics.")
    p.add_argument("--ace-out", type=Path, required=True)
    p.add_argument("--jobs", type=Path, required=True)
    p.add_argument("--out", type=Path, required=True)
    args = p.parse_args()

    raw = json.loads(args.jobs.read_text(encoding="utf-8"))
    jobs = raw["jobs"] if isinstance(raw, dict) else raw
    picks: dict[str, str] = {}
    report: dict[str, dict] = {}
    print(f"{'job':20} {'take':5} {'peak':>6} {'rms':>6} {'onset':>6} {'front':>6} {'cv':>6} {'clip':>5} {'score':>7}")
    for job in jobs:
        jid = job["id"]
        dur = float(job.get("duration", 4))
        is_loop = jid in LOOP_IDS or dur > 8
        job_dir = args.ace_out / jid
        takes = sorted([d for d in job_dir.iterdir() if d.is_dir() and d.name.lower().startswith("v")]) if job_dir.is_dir() else []
        if not takes:
            print(f"{jid:20} (no v## takes found)")
            continue
        best: tuple[float, str] | None = None
        for take in takes:
            media = newest_media(take)
            if not media:
                continue
            m = analyze(media, dur, is_loop)
            report.setdefault(jid, {})[take.name] = m
            print(f"{jid:20} {take.name:5} {m['peak_dbfs']:6.1f} {m['rms_dbfs']:6.1f} {m['onset_s']:6.3f} {m['front_energy']:6.3f} {m['rms_cv']:6.3f} {m['clipped']:5d} {m['score']:7.3f}")
            if best is None or m["score"] > best[0]:
                best = (m["score"], take.name)
        if best:
            picks[jid] = best[1]
            print(f"{'':20} -> {best[1]}")
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps({"picks": picks, "metrics": report}, indent=2), encoding="utf-8")
    print(f"wrote {args.out} ({len(picks)} picks)")


if __name__ == "__main__":
    main()
