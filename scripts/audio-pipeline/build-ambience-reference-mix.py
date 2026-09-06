#!/usr/bin/env python3
"""
Blend a set of reference tracks into one WAV for ACE-Step `reference_audio`.

`jobs.run-bed-ambience.json` wants the run loop to take its character from a whole *set* of
tracks rather than one file, and ACE-Step accepts a single `reference_audio` per job. This writes a
reference WAV under `scripts/audio-pipeline/reference-audio/` (gitignored): every source is
level-matched, trimmed to an excerpt from its middle, then the excerpts are chained with equal-power
crossfades so the style embedding sees every texture.

Sources are basenames under `src/renderer/assets/audio/dont_modify/` (the default set), or the paths
in `--list` (a text file, one path per line, `#` comments). Relative list paths resolve against the
first ancestor folder where they exist (the folder holding the repositories, also from a git
worktree), so the sibling `cross-repo-libs/references/...` sample library can be named. MP3 sources decode through ffmpeg when libsndfile refuses them.

  .venv-audio\\Scripts\\python.exe scripts/audio-pipeline/build-ambience-reference-mix.py
  .venv-audio\\Scripts\\python.exe scripts/audio-pipeline/build-ambience-reference-mix.py \
      --list scripts/audio-pipeline/run-bed-references.txt \
      --out scripts/audio-pipeline/reference-audio/Library_mix.wav --seconds-per-source 5
"""

from __future__ import annotations

import argparse
import subprocess
from pathlib import Path

import numpy as np
import soundfile as sf

ROOT = Path(__file__).resolve().parents[2]
SOURCE_DIR = ROOT / "src" / "renderer" / "assets" / "audio" / "dont_modify"
DEFAULT_SOURCES = ["Menu_atmo.wav", "Music_thunder.wav", "Misc_Ventilator.wav"]
OUT = ROOT / "scripts" / "audio-pipeline" / "reference-audio" / "Ambience_mix.wav"
MIN_SOURCE_SECONDS = 6.0


def load_mono(path: Path, sr_target: int) -> np.ndarray:
    try:
        data, sr = sf.read(str(path), always_2d=True, dtype="float64")
    except Exception:  # noqa: BLE001 - e.g. an MP3 on a libsndfile build without the decoder
        raw = subprocess.run(
            ["ffmpeg", "-v", "error", "-i", str(path), "-f", "f32le", "-ac", "1", "-ar", str(sr_target), "-"],
            capture_output=True,
            check=True,
        ).stdout
        return np.frombuffer(raw, dtype=np.float32).astype(np.float64)
    mono = data.mean(axis=1)
    if sr != sr_target:
        x_old = np.arange(len(mono))
        n_new = int(len(mono) * sr_target / sr)
        mono = np.interp(np.arange(n_new) * (sr / sr_target), x_old, mono)
    return mono


def level_match(x: np.ndarray, target_rms_db: float) -> np.ndarray:
    rms = float(np.sqrt(np.mean(x**2))) or 1e-9
    return x * (10 ** (target_rms_db / 20) / rms)


def crossfade_chain(parts: list[np.ndarray], fade: int) -> np.ndarray:
    out = parts[0]
    t = np.linspace(0.0, 1.0, fade, endpoint=False)
    fi, fo = np.sin(0.5 * np.pi * t), np.cos(0.5 * np.pi * t)
    for nxt in parts[1:]:
        seam = out[-fade:] * fo + nxt[:fade] * fi
        out = np.concatenate([out[:-fade], seam, nxt[fade:]])
    return out


def read_list(path: Path) -> list[Path]:
    sources: list[Path] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        candidate = Path(line)
        if candidate.is_absolute():
            sources.append(candidate)
            continue
        # Relative to the folder holding the repositories; walk up so git worktrees under
        # <repo>/.claude/worktrees/<name> resolve the same paths as the main checkout.
        resolved = next((anc / candidate for anc in ROOT.parents if (anc / candidate).exists()), ROOT.parent / candidate)
        sources.append(resolved)
    if not sources:
        raise SystemExit(f"{path} lists no sources.")
    return sources


def main() -> None:
    p = argparse.ArgumentParser(description="Blend reference tracks into one ACE-Step reference WAV.")
    p.add_argument("--sources", nargs="*", default=DEFAULT_SOURCES, help="Basenames under dont_modify/.")
    p.add_argument("--list", type=Path, default=None, help="Text file of source paths (overrides --sources).")
    p.add_argument("--seconds-per-source", type=float, default=0.0, help="Excerpt length per source (0 = whole file).")
    p.add_argument("--out", type=Path, default=OUT)
    p.add_argument("--sample-rate", type=int, default=48000)
    p.add_argument("--target-rms-db", type=float, default=-20.0)
    p.add_argument("--crossfade", type=float, default=1.5)
    args = p.parse_args()

    sr = args.sample_rate
    fade = int(args.crossfade * sr)
    sources = read_list(args.list) if args.list else [SOURCE_DIR / name for name in args.sources]
    missing = [str(s) for s in sources if not s.is_file()]
    if missing:
        raise SystemExit("Missing source(s):\n  " + "\n  ".join(missing))

    parts: list[np.ndarray] = []
    for src in sources:
        part = level_match(load_mono(src, sr), args.target_rms_db)
        # Short one-shots (a 1 s hum, a bell) are tiled so every source spans at least a few seconds.
        if len(part) < MIN_SOURCE_SECONDS * sr:
            part = np.tile(part, int(np.ceil(MIN_SOURCE_SECONDS * sr / max(len(part), 1))))
        if args.seconds_per_source > 0 and len(part) > int(args.seconds_per_source * sr):
            n = int(args.seconds_per_source * sr)
            start = (len(part) - n) // 2
            part = part[start : start + n]
        parts.append(part)

    # A crossfade longer than a third of the shortest excerpt would swallow whole sources.
    fade = max(1, min(fade, min(len(part) for part in parts) // 3))
    mix = crossfade_chain(parts, fade)
    peak = float(np.max(np.abs(mix))) or 1e-9
    if peak > 0.9:
        mix *= 0.9 / peak
    args.out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(args.out), np.stack([mix, mix], axis=1), sr, subtype="PCM_16")
    print(f"wrote {args.out} ({len(mix) / sr:.1f}s from {len(sources)} source(s))")


if __name__ == "__main__":
    main()
