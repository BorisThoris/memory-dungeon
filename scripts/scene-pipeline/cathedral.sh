#!/usr/bin/env bash
# The cathedral (main menu, game over) as a base, two light layers and candle-flame sprites: cut the
# flames, segment the candlelight and the wisps out of the still plate, export PNG masters + WebP
# into src/renderer/assets/ui/{backgrounds,sprites}. No Blender pass: the candles are many and
# small, and their painted pools of light flicker well enough as one layer.
#
#   bash scripts/scene-pipeline/cathedral.sh [plate.png] [prefix] [boxes.json]
set -euo pipefail
winpath() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
PIPE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
REPO="$(winpath "$(cd "$PIPE/../.." && pwd)")"
ASSETS="$REPO/src/renderer/assets/ui/backgrounds"
SPRITES="$REPO/src/renderer/assets/ui/sprites"
PLATE="${1:-$ASSETS/bg-main-menu-cathedral-v1.png}"
PREFIX="${2:-bg-main-menu-cathedral-v2}"
BOXES="${3:-$PIPE/sprites/bg-main-menu-cathedral.json}"
BUILD="$(winpath "${SCENE_BUILD:-$HOME/Desktop/memory-dungeon-reel/build/scene}")/cathedral"
PY="${REEL_PY:-py -3.12}"   # numpy + Pillow + scipy
QUALITY="${UI_BACKGROUND_WEBP_QUALITY:-84}"

echo "== cut sprites"
$PY "$PIPE/cut_sprites.py" "$PLATE" "$BUILD/sprites" --boxes "$BOXES" --prefix "$PREFIX" --frames 12 --fps 10
echo "== segment"
$PY "$PIPE/segment_cathedral.py" "$BUILD/sprites/$PREFIX-plate-still.png" "$BUILD/layers" --prefix "$PREFIX"
echo "== export"
cp "$BUILD/layers/$PREFIX-base.png" "$BUILD/layers/$PREFIX-glow-candles.png" "$BUILD/layers/$PREFIX-glow-wisps.png" "$ASSETS/"
for f in base glow-candles glow-wisps; do
    ffmpeg -y -hide_banner -loglevel error -i "$ASSETS/$PREFIX-$f.png" -c:v libwebp -quality "$QUALITY" -compression_level 6 "$ASSETS/$PREFIX-$f.webp"
    printf '  %-18s %5d KB\n' "$f" $(( $(stat -c %s "$ASSETS/$PREFIX-$f.webp") / 1024 ))
done
mkdir -p "$SPRITES"
rm -f "$SPRITES/$PREFIX-sprite-"*
cp "$BUILD/sprites/$PREFIX-sprite-"*.png "$BUILD/sprites/$PREFIX-sprite-"*.webp "$BUILD/sprites/$PREFIX-sprites.json" "$SPRITES/"
printf '  %d sprite strips, %d KB of WebP\n' "$(ls "$SPRITES/$PREFIX-sprite-"*.webp | wc -l)" $(( $(cat "$SPRITES/$PREFIX-sprite-"*.webp | wc -c) / 1024 ))
echo "check sheets: $BUILD/layers/check-sheet.png, $BUILD/sprites/sprites-sheet.png, $BUILD/sprites/still-vs-rebuilt.png"
