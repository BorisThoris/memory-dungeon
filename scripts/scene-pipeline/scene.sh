#!/usr/bin/env bash
# The gameplay backdrop as relightable layers: segment the painting, render the light-group passes
# in Blender, export PNG masters + WebP runtime files into src/renderer/assets/ui/backgrounds.
#
#   bash scripts/scene-pipeline/scene.sh [plate.png] [prefix]
#
# Defaults: the dungeon-ring plate, prefix bg-gameplay-dungeon-ring-v2. Deterministic: the
# segmentation is pure numpy, the Cycles render is seeded (fixed sample count, no denoiser).
set -euo pipefail
winpath() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
PIPE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
REPO="$(winpath "$(cd "$PIPE/../.." && pwd)")"
ASSETS="$REPO/src/renderer/assets/ui/backgrounds"
PLATE="${1:-$ASSETS/bg-gameplay-dungeon-ring-v1.png}"
PREFIX="${2:-bg-gameplay-dungeon-ring-v2}"
BUILD="$(winpath "${SCENE_BUILD:-$HOME/Desktop/memory-dungeon-reel/build/scene}")"
BLENDER="${BLENDER:-E:/Program Files/Blender Foundation/Blender 4.3/blender.exe}"
PY="${REEL_PY:-py -3.12}"   # numpy + Pillow
QUALITY="${UI_BACKGROUND_WEBP_QUALITY:-84}"

echo "== segment"
$PY "$PIPE/segment_scene.py" "$PLATE" "$BUILD/layers" --prefix "$PREFIX"
echo "== blender light passes"
"$BLENDER" -b -P "$PIPE/blender_scene_lights.py" -- --plate "$BUILD/layers/$PREFIX-base.png" --scene "$BUILD/layers/scene.json" --out "$BUILD/lights" --prefix "$PREFIX" | grep "^RELIT\|^Time"
echo "== export"
cp "$BUILD/layers/$PREFIX-base.png" "$BUILD/layers/$PREFIX-glow-ring.png" "$BUILD/layers/$PREFIX-glow-torches.png" "$BUILD/layers/$PREFIX-glow-runes.png" "$ASSETS/"
cp "$BUILD/lights/$PREFIX-light-ring.png" "$ASSETS/$PREFIX-light-ring.png"
cp "$BUILD/lights/$PREFIX-light-torches_l.png" "$ASSETS/$PREFIX-light-torches-l.png"
cp "$BUILD/lights/$PREFIX-light-torches_r.png" "$ASSETS/$PREFIX-light-torches-r.png"
for f in base glow-ring glow-torches glow-runes light-ring light-torches-l light-torches-r; do
    ffmpeg -y -hide_banner -loglevel error -i "$ASSETS/$PREFIX-$f.png" -c:v libwebp -quality "$QUALITY" -compression_level 6 "$ASSETS/$PREFIX-$f.webp"
    printf '  %-18s %5d KB\n' "$f" $(( $(stat -c %s "$ASSETS/$PREFIX-$f.webp") / 1024 ))
done
echo "layers -> $ASSETS/$PREFIX-*.webp (masters .png beside them); check sheet: $BUILD/layers/check-sheet.png"
