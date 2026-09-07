#!/usr/bin/env python3
"""
Copy chosen Z-Image-Turbo takes from tmp/zimage/<manifest stem>/ to the `target` path each
manifest entry declares (optionally resizing to `targetSize`), so a batch can be re-installed
from a small picks file instead of by hand.

Picks file: JSON object { "<entry id>": <take number 1..N> }. Ids not listed use --default-take.
Entries may carry `targetSize` [w, h] (Lanczos resize) and `alphaFrom` (a grayscale PNG whose values
become the output alpha, so semi-transparent scene layers keep the profile their CSS was tuned for), and
`gain` (RGB multiplier, e.g. 0.5 to sink a board texture into the theme's dark value range), and
`cropInset` (fraction trimmed from every side before resizing, to cut off edge frames).

  py -3.12 scripts/card-pipeline/install_zimage_picks.py --manifest scripts/card-pipeline/ui-backgrounds.zimage.manifest.json --picks scripts/card-pipeline/ui-backgrounds.zimage.picks.json
  py -3.12 scripts/card-pipeline/install_zimage_picks.py --manifest ... --only bg-mode-puzzle-v1 --default-take 2 --dry-run

After installing UI backgrounds run `yarn assets:ui-backgrounds:export-runtime-webp`; after face
panels run `yarn face-panels:export-runtime-webp` (see ASSET_SOURCES.md).
"""

from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Install picked Z-Image takes to their manifest targets.")
    p.add_argument("--manifest", type=Path, required=True)
    p.add_argument("--picks", type=Path, default=None, help="JSON { id: take }. Missing ids use --default-take.")
    p.add_argument("--default-take", type=int, default=1)
    p.add_argument("--renders", type=Path, default=None, help="Render folder (default: tmp/zimage/<manifest stem>).")
    p.add_argument("--only", default="", help="Comma-separated entry ids (default: all with a target).")
    p.add_argument("--repo-root", type=Path, default=None)
    p.add_argument("--dry-run", action="store_true")
    return p.parse_args()


def main() -> None:
    args = parse_args()
    root = (args.repo_root or repo_root()).resolve()
    manifest_path = args.manifest.resolve()
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    renders = (args.renders or (root / "tmp" / "zimage" / manifest_path.stem)).resolve()
    picks: dict[str, int] = {}
    if args.picks:
        picks = {k: int(v) for k, v in json.loads(args.picks.read_text(encoding="utf-8")).items()}
    only = {s.strip() for s in args.only.split(",") if s.strip()}

    from PIL import Image  # noqa: PLC0415

    installed = 0
    for entry in manifest["entries"]:
        entry_id = entry["id"]
        target_rel = entry.get("target")
        if not target_rel or (only and entry_id not in only):
            continue
        take = picks.get(entry_id, args.default_take)
        src = renders / f"{entry_id}-c{take:02d}.png"
        if not src.is_file():
            raise SystemExit(f"Missing render for {entry_id} take {take}: {src}")
        target = (root / target_rel).resolve()
        size = entry.get("targetSize")
        action = f"{src.name} -> {target_rel}" + (f" (resize {size[0]}x{size[1]})" if size else "") + (f" (alpha from {entry['alphaFrom']})" if entry.get("alphaFrom") else "") + (f" (gain {entry['gain']})" if entry.get("gain") is not None else "")
        print(("  [dry] " if args.dry_run else "  ") + action)
        if args.dry_run:
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        alpha_from = entry.get("alphaFrom")
        if size or alpha_from or entry.get("cropInset"):
            with Image.open(src) as im:
                out = im.convert("RGBA" if (im.mode == "RGBA" or alpha_from) else "RGB")
                crop = float(entry.get("cropInset") or 0)
                if crop > 0:
                    # Drop a thin border on every side: the model tends to paint a frame right at the canvas edge.
                    w, h = out.size
                    out = out.crop((round(w * crop), round(h * crop), round(w * (1 - crop)), round(h * (1 - crop))))
                if size:
                    out = out.resize((int(size[0]), int(size[1])), Image.Resampling.LANCZOS)
                gain = entry.get("gain")
                if gain is not None:
                    # Scale RGB (alpha untouched) so a render sits in the theme's value range, e.g. a board texture under cards.
                    rgb = out.convert("RGB").point(lambda v, g=float(gain): max(0, min(255, round(v * g))))
                    out = rgb.convert("RGBA") if out.mode == "RGBA" else rgb
                if alpha_from:
                    # Reuse a hand-tuned alpha profile (e.g. the previous master's) so CSS layers below still show through.
                    with Image.open(root / alpha_from) as mask_im:
                        mask = mask_im.convert("L").resize(out.size, Image.Resampling.LANCZOS)
                    out.putalpha(mask)
                out.save(target, optimize=True)
        else:
            shutil.copyfile(src, target)
        installed += 1

    print(f"{'Planned' if args.dry_run else 'Installed'} {installed if not args.dry_run else 'all listed'} file(s) from {renders}")


if __name__ == "__main__":
    main()
