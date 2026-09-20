// Reel v6 edit plan at 60 fps: derives the cut from the deterministic take's frame-exact marks,
// then emits (1) the ffmpeg build script and (2) the event list for the positional SFX stem.
//
//   node edit60.mjs <take dir> <out dir>
import fs from 'node:fs';
import path from 'node:path';

const [TAKE, OUT, COLOPHON_FRAME] = process.argv.slice(2);
const cap = JSON.parse(fs.readFileSync(path.join(TAKE, 'capture.json'), 'utf8'));
const marks = JSON.parse(fs.readFileSync(path.join(TAKE, 'marks.json'), 'utf8'));
const FPS = cap.fps;
const m = Object.fromEntries(marks.map((x) => [x.label, x]));
const need = (k) => { if (!m[k]) throw new Error(`mark ${k} missing`); return m[k]; };

// The beats: the pair whose match makes the score pop the most is the break.
const scores = marks.filter((x) => x.label.startsWith('score-')).map((x) => ({ i: Number(x.label.split('-')[1]), v: Number(String(x.score).replace(/[^0-9]/g, '')) }));
let breakPair = 0, best = 0;
for (let i = 1; i < scores.length; i++) { const d = scores[i].v - scores[i - 1].v; if (d > best) { best = d; breakPair = scores[i].i; } }
const fa = need(`flip-${breakPair}a`), fb = need(`flip-${breakPair}b`);
const colophon = COLOPHON_FRAME ? { frame: Number(COLOPHON_FRAME), t: Number(COLOPHON_FRAME) / FPS } : need('colophon');
const gone = need('colophon-gone');

// Segment C: from 1.0 s before the first flip of the break pair to the colophon (target 2.2 s);
// segment D: the colophon for 1.5 s.
const cLen = 2.2, dLen = 1.5;
const cEnd = colophon.t;
const cStart = Math.max(need('play').t, cEnd - cLen);
const dStart = colophon.t;
const timeline = {
    fps: FPS, hero: [0.0, 1.8], board: [1.8, 4.0], c: [4.0, 4.0 + (cEnd - cStart)], d: null, e: null,
    src: { c: [cStart, cEnd], d: [dStart, dStart + dLen] }
};
timeline.d = [timeline.c[1], timeline.c[1] + dLen];
timeline.e = [timeline.d[1], 10.0];
const toReel = (t) => 4.0 + (t - cStart);
const zoom = (t) => 1.30 + 0.10 * (t - 4.0) / (timeline.c[1] - 4.0);
const gameX = (cssX, tReel) => { const z = zoom(tReel); return (cssX * cap.dpr * (1080 / cap.width) * z - (1080 * z - 1080) / 2) / 1080; };

const events = [];
const flipsInC = marks.filter((x) => /^flip-\d+[ab]$/.test(x.label) && x.t >= cStart && x.t < cEnd);
for (const f of flipsInC) events.push({ t: toReel(f.t), kind: 'fx-card-flip', x: gameX(f.at.x, toReel(f.t)), label: `game: ${f.label} tapped` });
// The pop: the second flip of the break pair resolves ~0.15 s later at the pair's midpoint.
const tPop = toReel(fb.t) + 10 / FPS;
events.push({ t: tPop, kind: 'fx-clump-pop', x: gameX((fa.at.x + fb.at.x) / 2, tPop), label: `game: the break (pair ${breakPair}, +${best})` });
events.push({ t: timeline.d[0] + 0.02, kind: 'fx-floor-clear', x: 0.5, label: 'colophon: floor cleared' });
events.push({ t: timeline.e[0] + 0.02, kind: 'fx-logo-boom', x: 0.5, label: 'end card: title lands' });

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'timeline.json'), JSON.stringify({ timeline, events, breakPair, breakGain: best, musicHitAt: tPop }, null, 2));
console.log(JSON.stringify({ breakPair, breakGain: best, cSrc: timeline.src.c.map((v) => v.toFixed(2)), dSrc: timeline.src.d.map((v) => v.toFixed(2)), c: timeline.c.map((v) => v.toFixed(2)), d: timeline.d.map((v) => v.toFixed(2)), e: timeline.e.map((v) => v.toFixed(2)), pop: tPop.toFixed(2), colophonLasts: (gone.t - colophon.t).toFixed(2) }));
