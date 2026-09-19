#!/usr/bin/env bash
# Reel v6 at 60 fps: 60 fps Blender shots, the deterministic 60 fps take (artwork plate behind the
# board), frame-exact cut from edit60's timeline.json, vignette + fine grain over the whole reel,
# ACE-Step score ducked under the generated positional SFX, two-pass master.
# Usage: build60.sh <take dir> <timeline.json> <music.wav> <stem.wav> <out.mp4>
#   env REEL_BLENDER = dir with hero-60/ and board-60/ frames, REEL_CARDS = dir with the lower thirds
#   and end card (cards2), MUSIC_HIT / MUSIC_GAIN / STEM_GAIN as below. reel.sh sets all of these.
set -euo pipefail
R="$(cd "$(dirname "$0")" && pwd)"
TAKE="$1"; PLAN="$2"; MUSIC="$3"; STEM="$4"; OUT="$5"
BL="${REEL_BLENDER:-$R/blender}"; CARDS="${REEL_CARDS:-$R/cards2}"
FPS=60
j() { node -e "const p=require('$PLAN');console.log($1)"; }
C0=$(j "p.timeline.src.c[0]"); C1=$(j "p.timeline.src.c[1]"); D0=$(j "p.timeline.src.d[0]"); D1=$(j "p.timeline.src.d[1]")
CL=$(node -e "console.log(($C1-$C0).toFixed(4))"); DL=$(node -e "console.log(($D1-$D0).toFixed(4))")
CE=$(j "p.timeline.c[1]"); DE=$(j "p.timeline.d[1]"); EL=$(node -e "console.log((10-$DE).toFixed(4))")
POP=$(j "p.musicHitAt")
# Delay the cue so its hit lands on the pop (hybrid v02, the pick: 5.02 s; choral v03 was 4.66 s).
MUSIC_HIT="${MUSIC_HIT:-5.02}"   # where the cue's hit sits in the music file (s)
MUSIC_DELAY_MS=$(node -e "console.log(Math.max(0, Math.round(($POP-$MUSIC_HIT)*1000)))")
MUSIC_GAIN="${MUSIC_GAIN:-0.7}"; STEM_GAIN="${STEM_GAIN:-1.0}"
echo "C src $C0-$C1 ($CL s) -> 4.0-$CE | D src $D0-$D1 -> $CE-$DE | E $DE-10 ($EL s) | pop $POP | music delay $MUSIC_DELAY_MS ms"
W=$(node -e "console.log(require('$TAKE/capture.json').width)")

ffmpeg -y -hide_banner -loglevel error \
  -framerate $FPS -i "$BL/hero-60/f_%04d.png" \
  -framerate $FPS -i "$BL/board-60/f_%04d.png" \
  -framerate $FPS -start_number $(node -e "console.log(Math.round($C0*$FPS))") -i "$TAKE/frames/f%05d.jpg" \
  -framerate $FPS -start_number $(node -e "console.log(Math.round($D0*$FPS))") -i "$TAKE/frames/f%05d.jpg" \
  -loop 1 -t "$EL" -i "$CARDS/end-plate.png" \
  -loop 1 -t "$EL" -i "$CARDS/end-fg.png" \
  -loop 1 -t 10 -i "$CARDS/l-hook.png" \
  -loop 1 -t 10 -i "$CARDS/l-study.png" \
  -loop 1 -t 10 -i "$CARDS/l-chain.png" \
  -i "$MUSIC" \
  -i "$STEM" \
  -filter_complex "
    [0:v]format=yuv420p,setsar=1,fade=t=in:st=0:d=0.3[a];
    [1:v]format=yuv420p,setsar=1[b];
    [2:v]trim=duration=$CL,setpts=PTS-STARTPTS,scale=w='trunc(1080*(1.30+0.10*t/$CL)/2)*2':h='trunc(1920*(1.30+0.10*t/$CL)/2)*2':eval=frame:flags=lanczos:in_range=jpeg:out_range=mpeg,crop=1080:1920:'(iw-1080)/2':'(ih-1920)/2-70',setsar=1[c];
    [3:v]trim=duration=$DL,setpts=PTS-STARTPTS,scale=w='trunc(1080*(1.26-0.24*min(t/0.45,1))/2)*2':h='trunc(1920*(1.26-0.24*min(t/0.45,1))/2)*2':eval=frame:flags=lanczos:in_range=jpeg:out_range=mpeg,crop=1080:1920:'(iw-1080)/2':'(ih-1920)/2-70*(1-min(t/0.45,1))',setsar=1,fade=t=out:st=$(node -e "console.log(($DL-0.3).toFixed(3))"):d=0.3[d];
    [4:v]fps=$FPS,scale=w='trunc(1080*(1.06+0.06*t/$EL)/2)*2':h='trunc(1920*(1.06+0.06*t/$EL)/2)*2':eval=frame:flags=lanczos,crop=1080:1920:'(iw-1080)/2':'(ih-1920)/2',format=yuv420p,setsar=1[e0];
    [5:v]format=rgba,fade=t=in:st=0.15:d=0.4:alpha=1[efg];
    [e0][efg]overlay=format=auto,fade=t=in:st=0:d=0.3,fade=t=out:st=$(node -e "console.log(($EL-0.25).toFixed(3))"):d=0.25[e];
    [a][b][c][d][e]concat=n=5:v=1:a=0,format=yuv420p,fps=$FPS[base];
    [6:v]format=rgba,fade=t=in:st=0.85:d=0.25:alpha=1,fade=t=out:st=1.55:d=0.2:alpha=1[l1];
    [7:v]format=rgba,fade=t=in:st=2.0:d=0.25:alpha=1,fade=t=out:st=3.7:d=0.25:alpha=1[l2];
    [8:v]format=rgba,fade=t=in:st=4.25:d=0.25:alpha=1,fade=t=out:st=$(node -e "console.log(($CE-0.3).toFixed(3))"):d=0.25:alpha=1[l3];
    [base][l1]overlay=format=auto:enable='between(t,0.85,1.8)'[v1];
    [v1][l2]overlay=format=auto:enable='between(t,2.0,4.0)'[v2];
    [v2][l3]overlay=format=auto:enable='between(t,4.25,$CE)'[v3];
    [v3]vignette=angle=PI/4.6:mode=forward,noise=all_seed=20260919:alls=6:allf=t+u,format=yuv420p[v];
    [9:a]atrim=0:9.5,asetpts=PTS-STARTPTS,afade=t=in:st=0:d=0.3,adelay=${MUSIC_DELAY_MS}|${MUSIC_DELAY_MS},afade=t=out:st=9.0:d=1.0,volume=${MUSIC_GAIN},apad=whole_dur=10.5,atrim=0:10.5[music];
    [10:a]atrim=0:10,asetpts=PTS-STARTPTS,volume=${STEM_GAIN},apad=whole_dur=10.5,atrim=0:10.5,asplit=2[sfx][key];
    [music][key]sidechaincompress=threshold=0.1:ratio=2.2:attack=12:release=280:level_sc=1.0:makeup=1[mduck];
    [mduck][sfx]amix=inputs=2:normalize=0:duration=longest,alimiter=limit=0.97,atrim=0:10[aud]
  " \
  -map "[v]" -map "[aud]" -t 10 -r $FPS \
  -c:v libx264 -preset slow -profile:v high -crf 17 -threads 8 -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -movflags +faststart -flags +bitexact -fflags +bitexact \
  -c:a pcm_s24le "${OUT%.mp4}-mix.mov"
bash "$R/master2.sh" "${OUT%.mp4}-mix.mov" "${OUT%.mp4}-mix.mov" "$OUT"
# keep the premaster next to the master for the report
ffmpeg -y -hide_banner -loglevel error -i "${OUT%.mp4}-mix.mov" -vn -ar 48000 -c:a pcm_s24le "${OUT%.mp4}-premaster.wav"
