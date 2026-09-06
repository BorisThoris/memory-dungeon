#!/usr/bin/env python3
"""
Local Z-Image-Turbo batch renderer (dev-only, offline after the first weight download).

Z-Image-Turbo (Tongyi-MAI, Apache-2.0, 6B DiT, 8-step distilled) replaces the SDXL base
checkpoint the older card/face-panel batches used. It runs fully on an RTX 3090-class GPU
(bf16 needs ~22 GB resident, so on 24 GB cards it offloads the idle text encoder to CPU by default).

Manifest JSON shape (see ui-backgrounds.zimage.manifest.json):

  {
    "defaults": { "width": 1376, "height": 768, "steps": 8, "candidates": 3 },
    "entries": [
      { "id": "bg-mode-puzzle-v1", "prompt": "...", "seed": 41001, "width": 1376, "height": 768 }
    ]
  }

Each entry renders `candidates` takes (seed, seed+1, ...) into
`<out>/<id>-c01.png` ... plus a per-batch contact sheet and `zimage-last-run.json`.
Pick a take by eye, then copy it to its final path (see ASSET_SOURCES.md).

Usage (from the repo root):
  py -3.12 scripts/card-pipeline/batch_local_zimage.py --manifest scripts/card-pipeline/ui-backgrounds.zimage.manifest.json --dry-run
  py -3.12 scripts/card-pipeline/batch_local_zimage.py --manifest scripts/card-pipeline/ui-backgrounds.zimage.manifest.json
  py -3.12 scripts/card-pipeline/batch_local_zimage.py --manifest ... --only bg-mode-puzzle-v1,bg-mode-mirror-puzzle-v1 --candidates 4
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_MODEL = "Tongyi-MAI/Z-Image-Turbo"
DEFAULT_STEPS = 8
DEFAULT_CANDIDATES = 3
# Z-Image latents are patchified 2x on top of the 8x VAE, so keep sides on a 16 px grid.
PIXEL_GRID = 16


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def snap(value: int) -> int:
    return max(PIXEL_GRID, int(round(value / PIXEL_GRID)) * PIXEL_GRID)


def load_manifest(path: Path) -> tuple[dict, list[dict]]:
    data = json.loads(path.read_text(encoding="utf-8"))
    entries = data.get("entries")
    if not isinstance(entries, list) or not entries:
        raise SystemExit(f"Manifest {path} must contain a non-empty 'entries' array.")
    defaults = data.get("defaults") or {}
    seen: set[str] = set()
    for entry in entries:
        if "id" not in entry or "prompt" not in entry:
            raise SystemExit(f"Every manifest entry needs 'id' and 'prompt': {entry}")
        if entry["id"] in seen:
            raise SystemExit(f"Duplicate manifest id: {entry['id']}")
        seen.add(entry["id"])
    return defaults, entries


def resolve_entry(entry: dict, defaults: dict, cli: argparse.Namespace) -> dict:
    width = snap(int(entry.get("width", defaults.get("width", 1024))))
    height = snap(int(entry.get("height", defaults.get("height", 1024))))
    steps = int(cli.steps or entry.get("steps", defaults.get("steps", DEFAULT_STEPS)))
    candidates = int(cli.candidates or entry.get("candidates", defaults.get("candidates", DEFAULT_CANDIDATES)))
    seed = int(entry.get("seed", defaults.get("seed", 0)))
    return {
        "id": entry["id"],
        "prompt": entry["prompt"].strip(),
        "width": width,
        "height": height,
        "steps": max(1, steps),
        "candidates": max(1, candidates),
        "seed": seed,
    }


def write_contact_sheet(out_dir: Path, rows: list[dict], sheet_path: Path) -> None:
    from PIL import Image, ImageDraw  # noqa: PLC0415

    thumbs: list[tuple[str, Image.Image]] = []
    for row in rows:
        for p in row["paths"]:
            im = Image.open(p).convert("RGB")
            im.thumbnail((360, 260))
            thumbs.append((Path(p).stem, im))
    if not thumbs:
        return
    cols = min(3, len(thumbs))
    cell_w, cell_h = 360, 282
    rows_n = math.ceil(len(thumbs) / cols)
    sheet = Image.new("RGB", (cols * cell_w, rows_n * cell_h), (12, 12, 18))
    draw = ImageDraw.Draw(sheet)
    for i, (label, im) in enumerate(thumbs):
        x = (i % cols) * cell_w
        y = (i // cols) * cell_h
        sheet.paste(im, (x + (cell_w - im.width) // 2, y))
        draw.text((x + 4, y + cell_h - 18), label, fill=(230, 230, 230))
    sheet.save(sheet_path)


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Batch Z-Image-Turbo renders from a JSON manifest.")
    p.add_argument("--manifest", type=Path, required=True, help="JSON manifest (defaults + entries).")
    p.add_argument("--repo-root", type=Path, default=None, help="Repo root for default output paths.")
    p.add_argument("--out", type=Path, default=None, help="Output folder (default: tmp/zimage/<manifest stem>).")
    p.add_argument("--model", default=os.environ.get("ZIMAGE_MODEL", DEFAULT_MODEL), help="HF model id or local path.")
    p.add_argument("--only", default="", help="Comma-separated entry ids to render (default: all).")
    p.add_argument("--candidates", type=int, default=None, help="Takes per entry (overrides manifest).")
    p.add_argument("--steps", type=int, default=None, help="Inference steps (overrides manifest; turbo wants 8).")
    p.add_argument("--cpu-offload", action="store_true", help="Force enable_model_cpu_offload (default below 23.5 GB free VRAM).")
    p.add_argument("--no-cpu-offload", action="store_true", help="Keep every component resident on the GPU (32 GB+ cards).")
    p.add_argument("--dry-run", action="store_true", help="Print the plan; do not import torch.")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    root = (args.repo_root or repo_root()).resolve()
    manifest_path = args.manifest.resolve()
    defaults, raw_entries = load_manifest(manifest_path)
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    entries = [resolve_entry(e, defaults, args) for e in raw_entries if not only or e["id"] in only]
    if only and len(entries) != len(only):
        missing = sorted(only - {e["id"] for e in entries})
        raise SystemExit(f"--only ids not in manifest: {missing}")

    out_dir = (args.out or (root / "tmp" / "zimage" / manifest_path.stem)).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    total_images = sum(e["candidates"] for e in entries)

    print(f"Model: {args.model}")
    print(f"Manifest: {manifest_path}")
    print(f"Out dir: {out_dir}")
    print(f"Entries: {len(entries)}  Images: {total_images}")
    for e in entries:
        print(f"  {e['id']}: {e['width']}x{e['height']} steps={e['steps']} x{e['candidates']} seed={e['seed']}")
    if args.dry_run:
        print("  ... dry-run OK")
        return

    try:
        import torch  # noqa: PLC0415
        from diffusers import ZImagePipeline  # noqa: PLC0415
    except ImportError as exc:
        raise SystemExit(
            "Missing dependencies. Install PyTorch (CUDA) and diffusers>=0.37 into the Python 3.12 install:\n"
            "  py -3.12 -m pip install torch torchvision --index-url https://download.pytorch.org/whl/cu124\n"
            "  py -3.12 -m pip install -r scripts/card-pipeline/requirements-local-card-backs.txt\n"
            f"Original error: {exc}"
        ) from exc

    if not torch.cuda.is_available():
        raise SystemExit("CUDA is not available. This script expects a CUDA GPU (e.g. RTX 3090).")

    t0 = time.time()
    pipe = ZImagePipeline.from_pretrained(args.model, torch_dtype=torch.bfloat16)
    free_bytes, total_bytes = torch.cuda.mem_get_info()
    free_gb = free_bytes / 1e9
    # bf16 transformer (~12 GB) + Qwen3 text encoder (~8 GB) + VAE/activations need ~22 GB resident; on a
    # 24 GB card with anything else open that spills into shared memory and each image takes minutes,
    # so offload unless the caller insists. Offload keeps only the active component on the GPU.
    use_offload = not args.no_cpu_offload and (args.cpu_offload or free_gb < 23.5)
    if use_offload:
        pipe.enable_model_cpu_offload()
    else:
        pipe.to("cuda")
    print(
        f"Pipeline loaded in {time.time() - t0:.1f}s "
        f"(free VRAM {free_gb:.1f}/{total_bytes / 1e9:.1f} GB, cpu offload={'on' if use_offload else 'off'})"
    )

    results: list[dict] = []
    for e in entries:
        paths: list[str] = []
        for take in range(e["candidates"]):
            seed = e["seed"] + take
            target = out_dir / f"{e['id']}-c{take + 1:02d}.png"
            t1 = time.time()
            image = pipe(
                prompt=e["prompt"],
                height=e["height"],
                width=e["width"],
                num_inference_steps=e["steps"],
                guidance_scale=0.0,
                generator=torch.Generator("cuda").manual_seed(seed),
            ).images[0]
            image.save(target)
            paths.append(str(target))
            print(f"  wrote {target.name} (seed {seed}, {time.time() - t1:.1f}s)")
        results.append({**e, "paths": paths})

    sheet = out_dir / "contact-sheet.png"
    write_contact_sheet(out_dir, results, sheet)
    manifest_out = out_dir / "zimage-last-run.json"
    manifest_out.write_text(
        json.dumps(
            {
                "generatedAt": datetime.now(timezone.utc).isoformat(),
                "model": args.model,
                "manifest": str(manifest_path),
                "outDir": str(out_dir),
                "results": results,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    print(f"Done: {total_images} images in {time.time() - t0:.0f}s -> {out_dir}")
    print(f"Contact sheet: {sheet}")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(130)
