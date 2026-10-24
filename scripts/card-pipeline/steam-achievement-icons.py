"""Cut the Steam achievement icons from a Z-Image batch (DGE-028, 2026-10-24).

Steam takes two 64x64 JPGs per achievement on the Partner site: the achieved icon and the
unachieved one. This reads the first dark-ground take `<takes>/<API name>-cNN.png` from a run of
`steam-achievements.zimage.manifest.json` and writes, into project-media/steam/achievements/:

  <API name>.jpg         the achieved icon, 64x64
  <API name>_locked.jpg  the unachieved icon: the same emblem in grey, dimmed
  achievements.md        the Partner rows (`yarn steam:partner-config`), to type in beside them

The upload is by hand (Steamworks > Stats & Achievements). Run:
  py -3.12 scripts/card-pipeline/steam-achievement-icons.py --takes D:/agent-work/.../steam-icons
"""
from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageOps

SIZE = 64
REPO = Path(__file__).resolve().parents[2]
MANIFEST = REPO / "scripts" / "card-pipeline" / "steam-achievements.zimage.manifest.json"
OUT = REPO / "project-media" / "steam" / "achievements"


def cut(source: Path, pale: bool) -> tuple[Image.Image, Image.Image]:
    image = Image.open(source).convert("RGB")
    # The medallion sits inside a dark margin: crop to it so it fills the 64 pixels.
    side = int(min(image.size) * 0.9)
    left, top = (image.width - side) // 2, (image.height - side) // 2
    icon = image.crop((left, top, left + side, top + side)).resize((SIZE, SIZE), Image.LANCZOS)
    # Some takes paint the corners pale: the medallion is round, so outside it is the dungeon's dark.
    mask = Image.new("L", (SIZE * 4, SIZE * 4), 0)
    # A medallion painted on a pale ground sits smaller in it: mask inside its rim, or a white ring shows.
    inset = 22 if pale else 2
    ImageDraw.Draw(mask).ellipse((inset, inset, SIZE * 4 - 1 - inset, SIZE * 4 - 1 - inset), fill=255)
    icon = Image.composite(icon, Image.new("RGB", (SIZE, SIZE), (12, 10, 9)), mask.resize((SIZE, SIZE), Image.LANCZOS))
    locked = ImageEnhance.Brightness(ImageOps.grayscale(icon).convert("RGB")).enhance(0.55)
    return icon, locked


def ground(path: Path) -> float:
    """The take's brightness at its edges: a medallion painted on a pale ground reads as a white ring."""
    image = Image.open(path).convert("L")
    w, h = image.size
    return sum(image.getpixel(xy) for xy in [(8, 8), (w - 9, 8), (8, h - 9), (w - 9, h - 9), (w // 2, 6), (6, h // 2)]) / 6


def pick(takes: Path, entry_id: str) -> Path | None:
    """The first take on a dark ground; else the first take."""
    found = sorted(takes.glob(f"{entry_id}-c*.png"))
    return next((t for t in found if ground(t) < 60), found[0] if found else None)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--takes", type=Path, required=True, help="The batch's output folder.")
    args = parser.parse_args()
    ids = [entry["id"] for entry in json.loads(MANIFEST.read_text(encoding="utf8"))["entries"]]
    OUT.mkdir(parents=True, exist_ok=True)
    picks = {i: pick(args.takes, i) for i in ids}
    missing = [i for i, take in picks.items() if take is None]
    if missing:
        raise SystemExit(f"no take for: {', '.join(missing)}")
    for i in ids:
        icon, locked = cut(picks[i], ground(picks[i]) >= 60)
        icon.save(OUT / f"{i}.jpg", quality=92)
        locked.save(OUT / f"{i}_locked.jpg", quality=92)
    rows = subprocess.run(["yarn", "-s", "tsx", "scripts/steam-partner-config.ts"], cwd=REPO, capture_output=True, text=True, encoding="utf8", shell=True, check=True).stdout
    (OUT / "achievements.md").write_text(rows.split("# Rich Presence")[0].rstrip() + "\n\nIcons: `<API Name>.jpg` (achieved) and `<API Name>_locked.jpg` (unachieved), 64x64.\n", encoding="utf8")
    print(f"{len(ids)} achievements, {2 * len(ids)} icons in {OUT}")


if __name__ == "__main__":
    main()
