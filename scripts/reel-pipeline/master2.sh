#!/usr/bin/env bash
# Mastering chain for the reel (v6 mix -> delivered master).
#   1. Arc match (arc.py): the mix's momentary loudness is measured and a smooth, rate-limited gain
#      curve moves it onto the designed arc (riser -> hero -19, board steady, no hole at the cut, gameplay
#      rising, pop + colophon the one peak, end card settling). The old hand ride opened at -12 LUFS and
#      fell into a -22 hole at 3.2 s.
#   2. Corrective EQ: rumble filter, low shelf -1.5 dB, mud -1.2 dB @ 300 Hz, presence +1.5 dB @ 3 kHz
#      and +1 dB @ 4.2 kHz, air shelf +3 dB @ 5.5 kHz (the mix measured ~12 dB darker above 2.5 kHz
#      than below 250 Hz, which phone speakers punish).
#   3. Mono compatibility: bass mono below 150 Hz, side level -7.5 dB above (LR4 crossover); the
#      generated score summed 4.6 dB quieter in mono with 13 % anti-phase frames.
#   4. Bus glue: gentle 1.3:1 compressor, slow, soft knee; then the end-card sub trim (-4 dB < 70 Hz
#      from 7.6 s) so phone speakers do not rattle on the logo boom.
#   5. Look-ahead brickwall limiter (4x oversampled) with an adaptive ceiling (-1.3 dBTP minus the gain
#      the normalisation will add), so the final stage is a single linear gain. Without it loudnorm
#      falls back to a dynamic AGC that flattens the arc.
#   6. Two-pass loudness normalisation to -14 LUFS integrated, -1 dBTP true peak (Instagram/Reels).
# Usage: master2.sh <mix.wav or -mix.mov> <video.mp4 to remux from> <out.mp4>
set -euo pipefail
IN="$1"; VID="$2"; OUT="$3"
TMP="$(mktemp -d)"
ffmpeg -y -hide_banner -loglevel error -i "$IN" -vn -ar 48000 -c:a pcm_s24le "$TMP/mix0.wav"
# 1. Arc match (arc.py): measured momentary loudness -> smooth gain toward the designed arc.
${REEL_PY:-py -3.12} "$(dirname "$0")/arc.py" "$TMP/mix0.wav" "$TMP/mix.wav" "${OUT%.mp4}-arc.txt" > /dev/null

EQ="highpass=f=26:poles=2,lowshelf=f=90:g=-1.5,equalizer=f=300:t=q:w=1.2:g=-1.2,equalizer=f=3000:t=q:w=1.0:g=1.0,equalizer=f=4200:t=q:w=1.2:g=0.8,highshelf=f=5500:g=2.5"
WIDTH="acrossover=split=150:order=4th[lo][hi];[lo]pan=stereo|c0=0.5*c0+0.5*c1|c1=0.5*c0+0.5*c1[lom];[hi]stereotools=slev=0.42[his];[lom][his]amix=inputs=2:normalize=0"
GLUE="acompressor=threshold=-20dB:ratio=1.3:attack=30:release=250:knee=8:makeup=1"
# End-card sub trim: from 7.6 s the sub (<60 Hz) was the loudest band (-18 dBFS RMS: the synthetic boom
# under the logo plus the score's lows). Phone speakers cannot reproduce it and rattle instead, which
# reads as clipping. Split the lows off, ride them -4 dB over the end card, sum back.
SUBTRIM="acrossover=split=70:order=4th[sb][rest];[sb]volume=volume='pow(10, if(lt(t,7.6),0, if(lt(t,7.9),-(t-7.6)/0.3*4, -4))/20)':eval=frame[sbr];[sbr][rest]amix=inputs=2:normalize=0"
# Adaptive ceiling: measure the loudness after ride/EQ/width/glue, work out the gain the final
# normalisation will apply (-14 LUFS minus that), and set the brickwall so that gain lands the true
# peaks at -1.3 dBTP. Then loudnorm has nothing to catch and stays linear.
ffmpeg -y -hide_banner -loglevel error -i "$TMP/mix.wav" -filter_complex "[0:a]${EQ},${WIDTH},${GLUE},${SUBTRIM}[out]" -map "[out]" -c:a pcm_s24le "$TMP/shaped.wav"
I_SHAPED=$(ffmpeg -hide_banner -i "$TMP/shaped.wav" -af "loudnorm=I=-14:TP=-1.0:LRA=9:print_format=json" -f null - 2>&1 | grep '"input_i"' | sed 's/.*: "\(.*\)".*/\1/')
CEIL_DB=$(node -e "const g=-14-($I_SHAPED); console.log((-1.3-g).toFixed(2))")
CEIL_LIN=$(node -e "console.log(Math.pow(10, ($CEIL_DB)/20).toFixed(4))")
echo "shaped: I=$I_SHAPED LUFS -> normalisation gain $(node -e "console.log((-14-($I_SHAPED)).toFixed(2))") dB -> limiter ceiling $CEIL_DB dBTP"
LIMIT="aresample=192000,alimiter=limit=${CEIL_LIN}:attack=5:release=120:level=false,aresample=48000"
ffmpeg -y -hide_banner -loglevel error -i "$TMP/shaped.wav" -af "$LIMIT" -c:a pcm_s24le "$TMP/pre.wav"
STATS=$(ffmpeg -hide_banner -i "$TMP/pre.wav" -af "loudnorm=I=-14:TP=-1.0:LRA=9:print_format=json" -f null - 2>&1 | sed -n '/^{/,/^}/p')
get() { echo "$STATS" | grep "\"$1\"" | sed 's/.*: "\(.*\)".*/\1/'; }
echo "pre-normalise: I=$(get input_i) LUFS  TP=$(get input_tp) dBTP  LRA=$(get input_lra)"
ffmpeg -y -hide_banner -i "$TMP/pre.wav" \
  -af "loudnorm=I=-14:TP=-1.0:LRA=9:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true:print_format=summary" \
  -ar 48000 -c:a pcm_s24le "${OUT%.mp4}-master.wav" 2>&1 | grep -E "Normalization Type|Output Integrated|Output True Peak" || true
ffmpeg -y -hide_banner -loglevel error -i "$VID" -i "${OUT%.mp4}-master.wav" -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -movflags +faststart -flags +bitexact -fflags +bitexact "$OUT"
rm -rf "$TMP"
echo "master -> $OUT (+ ${OUT%.mp4}-master.wav)"
