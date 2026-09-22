#!/usr/bin/env bash
# The portal clearing (the Classic poster, behind Choose Your Path) as a base, light layers and a
# spinning vortex: cut the disc, segment the runes, the moon and the stars, export PNG masters +
# WebP into src/renderer/assets/ui/{backgrounds,sprites}.
#
#   bash scripts/scene-pipeline/portal.sh [plate.png] [prefix]
set -euo pipefail
winpath() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
PIPE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
REPO="$(winpath "$(cd "$PIPE/../.." && pwd)")"
ASSETS="$REPO/src/renderer/assets/ui/backgrounds"
SPRITES="$REPO/src/renderer/assets/ui/sprites"
PLATE="${1:-$ASSETS/bg-mode-classic-v1.png}"
PREFIX="${2:-bg-mode-classic-v2}"
BUILD="$(winpath "${SCENE_BUILD:-$HOME/Desktop/memory-dungeon-reel/build/scene}")/portal"
PY="${REEL_PY:-py -3.12}"   # numpy + Pillow + scipy
QUALITY="${UI_BACKGROUND_WEBP_QUALITY:-84}"

echo "== cut the vortex"
$PY "$PIPE/cut_disc.py" "$PLATE" "$BUILD/sprites" --prefix "$PREFIX" --id vortex --centre 692 385 --radius 95 --feather 34
echo "== segment"
$PY "$PIPE/segment_portal.py" "$PLATE" "$BUILD/layers" --prefix "$PREFIX"
echo "== export"
cp "$BUILD/layers/$PREFIX-base.png" "$BUILD/layers/$PREFIX-glow-runes.png" "$BUILD/layers/$PREFIX-glow-moon.png" "$BUILD/layers/$PREFIX-stars.png" "$ASSETS/"
for f in base glow-runes glow-moon stars; do
    ffmpeg -y -hide_banner -loglevel error -i "$ASSETS/$PREFIX-$f.png" -c:v libwebp -quality "$QUALITY" -compression_level 6 "$ASSETS/$PREFIX-$f.webp"
    printf '  %-18s %5d KB\n' "$f" $(( $(stat -c %s "$ASSETS/$PREFIX-$f.webp") / 1024 ))
done
mkdir -p "$SPRITES"
rm -f "$SPRITES/$PREFIX-sprite-"*
cp "$BUILD/sprites/$PREFIX-sprite-"*.png "$BUILD/sprites/$PREFIX-sprite-"*.webp "$BUILD/sprites/$PREFIX-sprites.json" "$SPRITES/"
printf '  vortex %5d KB\n' $(( $(stat -c %s "$SPRITES/$PREFIX-sprite-vortex.webp") / 1024 ))
echo "check sheet: $BUILD/layers/check-sheet.png"
