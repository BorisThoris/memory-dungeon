#!/usr/bin/env bash
# The gameplay backdrop as relightable layers and sprites: cut the flames out of the painting, segment
# the rest into base + light layers, render the light-group passes in Blender, export PNG masters +
# WebP runtime files into src/renderer/assets/ui/{backgrounds,sprites}.
#
#   bash scripts/scene-pipeline/scene.sh [plate.png] [prefix] [boxes.json]
#
# Defaults: the dungeon-ring plate, prefix bg-gameplay-dungeon-ring-v2, the flame boxes in
# sprites/bg-gameplay-dungeon-ring.json. Deterministic: the cut and the segmentation are pure
# numpy, the Cycles render is seeded (fixed sample count, no denoiser).
set -euo pipefail
winpath() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
PIPE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
REPO="$(winpath "$(cd "$PIPE/../.." && pwd)")"
ASSETS="$REPO/src/renderer/assets/ui/backgrounds"
SPRITES="$REPO/src/renderer/assets/ui/sprites"
PLATE="${1:-$ASSETS/bg-gameplay-dungeon-ring-v1.png}"
PREFIX="${2:-bg-gameplay-dungeon-ring-v2}"
BOXES="${3:-$PIPE/sprites/bg-gameplay-dungeon-ring.json}"
BUILD="$(winpath "${SCENE_BUILD:-$HOME/Desktop/memory-dungeon-reel/build/scene}")"
BLENDER="${BLENDER:-E:/Program Files/Blender Foundation/Blender 4.3/blender.exe}"
PY="${REEL_PY:-py -3.12}"   # numpy + Pillow + scipy + opencv
QUALITY="${UI_BACKGROUND_WEBP_QUALITY:-84}"

echo "== cut sprites"
$PY "$PIPE/cut_sprites.py" "$PLATE" "$BUILD/sprites" --boxes "$BOXES" --prefix "$PREFIX"
echo "== segment"
$PY "$PIPE/segment_scene.py" "$BUILD/sprites/$PREFIX-plate-still.png" "$BUILD/layers" --prefix "$PREFIX"
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
mkdir -p "$SPRITES"
rm -f "$SPRITES/$PREFIX-sprite-"*
cp "$BUILD/sprites/$PREFIX-sprite-"*.png "$BUILD/sprites/$PREFIX-sprite-"*.webp "$BUILD/sprites/$PREFIX-sprites.json" "$SPRITES/"
for f in "$SPRITES/$PREFIX-sprite-"*.webp; do printf '  %-48s %5d KB\n' "$(basename "$f")" $(( $(stat -c %s "$f") / 1024 )); done
echo "layers -> $ASSETS/$PREFIX-*.webp, sprites -> $SPRITES/$PREFIX-sprite-*.webp (masters .png beside them)"
echo "check sheets: $BUILD/layers/check-sheet.png, $BUILD/sprites/sprites-sheet.png, $BUILD/sprites/still-vs-rebuilt.png"
