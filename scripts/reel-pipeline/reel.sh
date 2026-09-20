#!/usr/bin/env bash
# Memory Dungeon — the 10 s Instagram reel, rebuilt from scratch, deterministically.
#
#   bash scripts/reel-pipeline/reel.sh            # every derived stage, skipping ones already built
#   bash scripts/reel-pipeline/reel.sh capture mix # just these stages (in pipeline order)
#   REEL_FORCE=1 bash scripts/reel-pipeline/reel.sh master
#
# Stages, in order (all derived — every input is pinned, see README.md):
#   verify    the frozen generative inputs in docs/wip-assets/reel match frozen.sha256
#   cards     card faces composited under the gold frame, plates, lower thirds, end card
#   blender   the hero and board shots (EEVEE, 60 fps) + card screen positions for the SFX pans
#   capture   the gameplay take: a seeded run (REEL_RUN_KEY) captured frame-exact at 60 fps
#   probe     (not in the default run) two quick takes of the same key, compared mark by mark and frame by frame
#   edit      the cut (timeline.json) from the take's frame-exact marks
#   stem      generated SFX shaped into one-shots and placed positionally
#   score     the picked ACE-Step take, de-clipped
#   mix       picture assembly + music/SFX mix, then the master (arc match, EQ, limiter, loudnorm)
#   report    the before/after mastering report
# Generative stages (only when re-rolling; their outputs are frozen in the repo):
#   gen-images   Z-Image-Turbo plates and faces from zimage/reel.zimage.manifest.json (seeded)
#   gen-audio    ACE-Step score and effects from ace/jobs-*.json (seeded), then the pickers
#   gen-copy     twelve Qwen3 copy drafts (lines.json is the hand pick)
set -euo pipefail
# Paths are kept in mixed form (C:/...) so Blender, Python and ffmpeg on Windows read them as-is; a
# comma-joined list of /c/... paths would not be converted by Git Bash.
winpath() { if command -v cygpath > /dev/null; then cygpath -m "$1"; else echo "$1"; fi; }
PIPE="$(winpath "$(cd "$(dirname "$0")" && pwd)")"
REPO="$(winpath "$(cd "$PIPE/../.." && pwd)")"
FROZEN="$REPO/docs/wip-assets/reel"
BUILD="$(winpath "${REEL_BUILD:-$HOME/Desktop/memory-dungeon-reel/build}")"

# ------------------------------------------------------------------ pinned parameters
RUN_KEY="${REEL_RUN_KEY:-md1:classic:49:20260919}"   # shared-run key: variant:rulesVersion:seed
FPS=60; DPR=3; QUALITY=95; PLATE_OPACITY=0.62          # capture
SAMPLES=64; FPS_MULT=2                                  # Blender (64 samples, 30 fps keys -> 60 fps)
export MUSIC_HIT=5.02 MUSIC_GAIN=0.7 STEM_GAIN=1.0      # where the score's hit sits; mix gains
# Which frozen candidates feed the cards (Z-Image renders 2 per entry; these were the picks).
FACE_CHALICE=hero-face-chalice-c02; FACE_TOWER=hero-face-tower-c01
FACE_SERPENT=hero-face-serpent-c02; FACE_CRYSTAL=hero-face-crystal-c02
PLATE_BLENDER=plate-corridor-c01; PLATE_GAME=plate-corridor-c02; PLATE_END=plate-cathedral-c01
SCORE_TAKE=score-hybrid-v02-seed621020.wav

# ------------------------------------------------------------------ tools (override by env)
BLENDER="${BLENDER:-E:/Program Files/Blender Foundation/Blender 4.3/blender.exe}"
PY="${REEL_PY:-py -3.12}"                                            # numpy + Pillow
# numpy + soundfile: the audio venv lives in the main checkout, so a worktree falls back to it.
MAIN_REPO="$(winpath "$(dirname "$(git -C "$REPO" rev-parse --path-format=absolute --git-common-dir)")")"
PY_AUDIO="${REEL_PY_AUDIO:-$REPO/.venv-audio/Scripts/python.exe}"
[ -x "$PY_AUDIO" ] || PY_AUDIO="$MAIN_REPO/.venv-audio/Scripts/python.exe"
BASE_URL="${REEL_BASE_URL:-http://127.0.0.1:5217/}"
export REEL_PY="$PY"

log() { printf '\n== %s\n' "$*"; }
done_marker() { [ -z "${REEL_FORCE:-}" ] && [ -e "$1" ]; }
mkdir -p "$BUILD"

stage_verify() {
    log "verify frozen inputs"
    (cd "$REPO" && sha256sum -c "$PIPE/frozen.sha256" --quiet) && echo "frozen inputs match frozen.sha256"
}

stage_cards() {
    local C="$BUILD/cards3d" L="$BUILD/cards2"
    done_marker "$L/end-fg.png" && { echo "cards: built"; return; }
    log "cards"
    mkdir -p "$C" "$L"
    local front="$REPO/docs/wip-assets/card-des/front.png"
    for p in chalice:$FACE_CHALICE tower:$FACE_TOWER serpent:$FACE_SERPENT crystal:$FACE_CRYSTAL; do
        $PY "$PIPE/compose_card.py" "$front" "$FROZEN/zimage/${p##*:}.png" "$C/face-${p%%:*}.png"
    done
    cp "$REPO/docs/wip-assets/card-des/back.png" "$C/back.png"
    ffmpeg -v error -y -i "$FROZEN/zimage/$PLATE_BLENDER.png" -vf "crop=iw*0.9:ih*0.9,scale=1080:1920:flags=lanczos" "$C/plate-corridor.png"
    ffmpeg -v error -y -i "$FROZEN/zimage/$PLATE_GAME.png" -vf "crop=iw*0.9:ih*0.9,scale=1080:1920:flags=lanczos" -c:v libwebp -quality 90 "$C/plate-game.webp"
    ffmpeg -v error -y -i "$FROZEN/zimage/$PLATE_END.png" -vf "crop=iw*0.92:ih*0.92,scale=1080:1920:flags=lanczos" "$L/end-plate.png"
    (cd "$REPO" && NODE_PATH="$REPO/node_modules" node "$PIPE/cards2.mjs" "$REPO" "$L" "$PIPE/lines.json")
}

stage_blender() {
    local C="$BUILD/cards3d" B="$BUILD/blender"
    done_marker "$B/pos-board.json" && { echo "blender: rendered"; return; }
    log "blender"
    mkdir -p "$B"
    local faces="$C/face-chalice.png,$C/face-tower.png,$C/face-serpent.png,$C/face-crystal.png"
    for shot in hero board; do
        rm -rf "$B/$shot-60"; mkdir -p "$B/$shot-60"
        "$BLENDER" -b -P "$PIPE/blender_reel.py" -- --shot $shot --faces "$faces" --back "$C/back.png" --plate "$C/plate-corridor.png" \
            --out "$B/$shot-60" --samples $SAMPLES --fps-mult $FPS_MULT > "$B/$shot-60.log" 2>&1
        echo "$shot: $(ls "$B/$shot-60" | wc -l) frames"
        REEL_POS=1 "$BLENDER" -b -P "$PIPE/blender_reel.py" -- --shot $shot --faces "$faces" --back "$C/back.png" --plate "$C/plate-corridor.png" \
            --out "$B/$shot-pos" 2>/dev/null | grep '^POS ' | sed 's/^POS //' > "$B/pos-$shot.json"
    done
}

ensure_server() {
    if curl -s -o /dev/null "$BASE_URL"; then return; fi
    log "starting the renderer dev server on $BASE_URL"
    (cd "$REPO" && yarn -s vite --host 127.0.0.1 --port 5217 --strictPort > "$BUILD/vite.log" 2>&1 &)
    for i in $(seq 1 60); do curl -s -o /dev/null "$BASE_URL" && return; sleep 1; done
    echo "dev server did not come up (see $BUILD/vite.log)"; exit 1
}

stage_capture() {
    local T="$BUILD/take"
    done_marker "$T/capture.json" && { echo "capture: taken"; return; }
    log "capture ($RUN_KEY, $FPS fps, dpr $DPR)"
    ensure_server
    rm -rf "$T"
    (cd "$REPO" && NODE_PATH="$REPO/node_modules" node "$PIPE/capture/capture.mjs" --scenario reel-floor2 --out "$T" --base "$BASE_URL" \
        --fps $FPS --dpr $DPR --quality $QUALITY --runKey "$RUN_KEY" --plate "$BUILD/cards3d/plate-game.webp" --plateOpacity $PLATE_OPACITY) | tee "$BUILD/take.log"
}

stage_probe() {
    # Determinism check: two quick takes (DPR 1) of the same key must agree on every mark and frame.
    log "probe: two DPR-1 takes of $RUN_KEY"
    ensure_server
    for i in a b; do
        rm -rf "$BUILD/probe/$i"
        (cd "$REPO" && NODE_PATH="$REPO/node_modules" node "$PIPE/capture/capture.mjs" --scenario reel-floor2 --out "$BUILD/probe/$i" --base "$BASE_URL"             --fps $FPS --dpr 1 --quality 80 --runKey "$RUN_KEY" > "$BUILD/probe/$i.log" 2>&1)
    done
    cmp "$BUILD/probe/a/marks.json" "$BUILD/probe/b/marks.json" && echo "marks: identical"
    local n=0 t=0
    for f in "$BUILD/probe/a/frames/"*.jpg; do t=$((t + 1)); cmp -s "$f" "$BUILD/probe/b/frames/$(basename "$f")" || n=$((n + 1)); done
    echo "frames: $n of $t differ"
}

stage_edit() {
    local E="$BUILD/edit"
    log "edit"
    mkdir -p "$E"
    node "$PIPE/edit60.mjs" "$BUILD/take" "$E"
}

stage_stem() {
    local E="$BUILD/edit" S="$BUILD/fx-shaped"
    log "stem"
    "$PY_AUDIO" "$PIPE/ace/fx_shape.py" "$FROZEN/ace/fx" "$S"
    (cd "$PIPE" && "$PY_AUDIO" "$PIPE/fx_stem60.py" "$S" "$BUILD/blender/pos-board.json" "$E/timeline.json" "$E/fx-stem.wav")
}

stage_score() {
    done_marker "$BUILD/score.wav" && { echo "score: ready"; return; }
    log "score (de-clip the picked take)"
    ffmpeg -v error -y -i "$FROZEN/ace/score/$SCORE_TAKE" -af "adeclip=window=55:overlap=75:arorder=8:threshold=10:hsize=1000:method=add" -c:a pcm_s24le "$BUILD/score.wav"
}

stage_mix() {
    log "mix + master"
    mkdir -p "$BUILD/out"
    REEL_BLENDER="$BUILD/blender" REEL_CARDS="$BUILD/cards2" \
        bash "$PIPE/build60.sh" "$BUILD/take" "$BUILD/edit/timeline.json" "$BUILD/score.wav" "$BUILD/edit/fx-stem.wav" "$BUILD/out/memory-dungeon-reel-10s.mp4"
}

stage_report() {
    log "report"
    $PY "$PIPE/report.py" "$BUILD/out/memory-dungeon-reel-10s-premaster.wav" "$BUILD/out/memory-dungeon-reel-10s-master.wav" \
        "$BUILD/out/mastering-report.png" "Memory Dungeon reel — $(cd "$REPO" && git rev-parse --short HEAD), run $RUN_KEY"
    ffmpeg -hide_banner -i "$BUILD/out/memory-dungeon-reel-10s.mp4" -vn -af ebur128=peak=true -f null - 2>&1 | grep -A16 Summary | grep "I:\|LRA:\|Peak:" | tr -s ' '
    echo "reel -> $BUILD/out/memory-dungeon-reel-10s.mp4"
}

# ------------------------------------------------------------------ generative (optional)
stage_gen_images() {
    log "Z-Image-Turbo (seeded manifest) -> $BUILD/gen/zimage"
    (cd "$REPO" && $PY scripts/card-pipeline/batch_local_zimage.py --manifest "$PIPE/zimage/reel.zimage.manifest.json" --out "$BUILD/gen/zimage" --cpu-offload)
    echo "pick candidates, copy them into $FROZEN/zimage, update FACE_*/PLATE_* above and frozen.sha256"
}
stage_gen_audio() {
    log "ACE-Step 1.5 XL turbo (seeded jobs) -> $BUILD/gen/ace"
    export CROSS_REPO_LIBS_ROOT="${CROSS_REPO_LIBS_ROOT:-$REPO/../cross-repo-libs}" PYTHONIOENCODING=utf-8
    export ACESTEP_PYTHON="${ACESTEP_PYTHON:-$PY_AUDIO}" ACESTEP_PROJECT_ROOT="${ACESTEP_PROJECT_ROOT:-$CROSS_REPO_LIBS_ROOT/local-models/ace-step-1.5}"
    (cd "$REPO" && yarn -s audio:ace-step:batch --jobs "$PIPE/ace/jobs-score.json" --out-dir "$BUILD/gen/ace/score" --config-path acestep-v15-xl-turbo --variants 3 --audio-format wav)
    (cd "$REPO" && yarn -s audio:ace-step:batch --jobs "$PIPE/ace/jobs-fx.json" --out-dir "$BUILD/gen/ace/fx" --config-path acestep-v15-xl-turbo --variants 4 --audio-format wav)
    "$PY_AUDIO" "$PIPE/ace/pick_score.py" "$BUILD/gen/ace/score" | head -12
    "$PY_AUDIO" "$PIPE/ace/pick_fx.py" "$BUILD/gen/ace/fx" "$BUILD/gen/ace/picked"
    echo "rank by crest factor / flat samples too (see README), then freeze the picks into $FROZEN/ace"
}
stage_gen_copy() { $PY "$PIPE/copy_lm.py" "$BUILD/gen/copy-candidates.json"; }

ALL="verify cards blender capture edit stem score mix report"
STAGES="${*:-$ALL}"
for s in $STAGES; do
    case "$s" in
        verify|cards|blender|capture|probe|edit|stem|score|mix|report) "stage_$s" ;;
        gen-images) stage_gen_images ;;
        gen-audio) stage_gen_audio ;;
        gen-copy) stage_gen_copy ;;
        *) echo "unknown stage $s"; exit 2 ;;
    esac
done
