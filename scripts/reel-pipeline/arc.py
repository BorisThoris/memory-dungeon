# Arc match: measure the mix's momentary loudness (EBU M, 0.1 s steps), compute a smooth, rate-limited
# gain curve toward the designed loudness arc, and apply it sample-accurately.  Replaces the hand ride,
# which was fighting a front-heavy mix (-12 LUFS opening, -22 hole at the gameplay cut, -9 climax).
#   python arc.py <in.wav> <out.wav> [report.txt]
import subprocess, sys, re, numpy as np, wave
src, dst = sys.argv[1:3]; rep = sys.argv[3] if len(sys.argv) > 3 else None
SR = 48000
# The designed arc in FINAL momentary LUFS (its own integrated loudness is ~-14, so the two-pass
# normalisation at the end is close to a no-op and the shape survives): a riser that lands the hero
# reveal at -18, board shots steady at -17.5, no hole at the cut, gameplay rising to -15, the pop and
# colophon as the one true peak at -10, the end card settling to -13.5, the fade left alone.
# HEADROOM puts the premaster ~6 dB under that so nothing clips before the brickwall.
ARC = [(0.45, -30), (0.7, -24), (1.0, -18), (1.7, -17.5), (1.9, -17.5), (3.1, -17.5), (3.3, -16.5), (3.6, -16),
       (4.9, -15), (5.3, -14.5), (5.7, -12), (6.1, -10), (6.9, -10.5), (7.3, -12), (7.7, -12.5), (7.9, -11.5),
       (8.3, -13), (9.0, -13.5), (9.2, -14)]
HEADROOM = -6.0
def momentary(f):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-i', f, '-af', 'ebur128=peak=none', '-f', 'null', '-'], capture_output=True, text=True)
    pts = [(float(a), float(b)) for a, b in re.findall(r't:\s*([0-9.]+)\s.*?M:\s*(-?[0-9.]+)', r.stderr)]
    return np.array(pts)
m = momentary(src); t = m[:, 0]; M = m[:, 1]
tgt = np.interp(t, [a for a, _ in ARC], [b for _, b in ARC])
g = tgt + HEADROOM - M
# Do not touch near-silence (the fade-in / fade-out) or the first 0.45 s; no lift after 9.2 s (the fade).
g[(M < -40) | (t < 0.45)] = 0
g[t > 9.2] = np.minimum(g[t > 9.2], HEADROOM)
g = np.clip(g, -7, 6)
# The momentary window trails by 0.4 s: shift the curve 0.2 s early so a cut is caught, not chased.
g = np.concatenate([g[2:], g[-1:], g[-1:]])
# Smooth (0.3 s box) then rate-limit to 16 dB/s so it never pumps against the SFX.
k = 3; g = np.convolve(np.pad(g, (k//2, k//2), mode='edge'), np.ones(k)/k, mode='valid')
lim = 16 * 0.1
for i in range(1, len(g)): g[i] = np.clip(g[i], g[i-1] - lim, g[i-1] + lim)
with wave.open(src, 'rb') as w:
    assert w.getframerate() == SR and w.getnchannels() == 2 and w.getsampwidth() == 3
    raw = w.readframes(w.getnframes())
a = np.frombuffer(raw, dtype=np.uint8).reshape(-1, 3).astype(np.int32)
x = (a[:, 0] | (a[:, 1] << 8) | (a[:, 2] << 16)); x = np.where(x >= 1 << 23, x - (1 << 24), x).astype(np.float64) / (1 << 23)
x = x.reshape(-1, 2)
ts = np.arange(len(x)) / SR
gain = 10 ** (np.interp(ts, t, g) / 20)
y = np.clip(x * gain[:, None], -1, 1)
yi = np.round(y * ((1 << 23) - 1)).astype(np.int32) & 0xFFFFFF
out = np.stack([yi & 0xFF, (yi >> 8) & 0xFF, (yi >> 16) & 0xFF], axis=-1).astype(np.uint8).reshape(-1)
with wave.open(dst, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(3); w.setframerate(SR); w.writeframes(out.tobytes())
lines = [f'{tt:4.1f}s  M {mm:6.1f}  target {tg:6.1f}  gain {gg:+5.1f} dB' for tt, mm, tg, gg in zip(t, M, tgt, g) if round(tt*10) % 5 == 0]
print('\n'.join(lines))
if rep: open(rep, 'w').write('\n'.join(lines))
