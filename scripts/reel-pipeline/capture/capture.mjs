// Deterministic game capture: Chromium's BeginFrame control + virtual time, so the game advances
// exactly 1/fps per frame and every frame is rendered and saved — no dropped or duplicated frames,
// and every event is logged with its exact frame number. The software renderer is slow (~1.7 wall
// fps at 3x), which does not matter: time is virtual.
//
//   node capture.mjs --scenario reel-floor2 --out dir --runKey md1:classic:49:20260919 [--fps 60] [--dpr 3] [--plate plate.png] [--quality 95] [--epoch ms] [--seed n]
//
// Scenarios live in ./scenarios/<name>.mjs and export `run(api)`. The api:
//   api.page, api.frames(n)            advance n frames, recording each (returns the frame index)
//   api.skip(seconds)                  advance game time without recording (off-camera play)
//   api.until(pred, maxSeconds, rec)   advance (recording if rec) until pred(state) is true
//   api.mark(label, extra)             log an event at the current frame
//   api.state()                        run shell / board status
//   api.pick(cell), api.rectOf(cell)   board hooks
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : true]);
    return acc;
}, []));
const FPS = Number(args.fps ?? 60);
const DPR = Number(args.dpr ?? 3);
const QUALITY = Number(args.quality ?? 95);
const OUT = args.out;
const BASE = args.base ?? 'http://127.0.0.1:5217/';
if (!args.scenario || !OUT) throw new Error('need --scenario and --out');
fs.mkdirSync(path.join(OUT, 'frames'), { recursive: true });

const SAVE = JSON.stringify({
    schemaVersion: 9, bestScore: 0, achievements: {},
    settings: { masterVolume: 0, musicVolume: 0, sfxVolume: 0, displayMode: 'windowed', uiScale: 1, reduceMotion: false,
        pairProximityHintsEnabled: false, tileFocusAssist: false,
        debugFlags: { showDebugTools: false, allowBoardReveal: false, disableAchievementsOnDebug: true } },
    onboardingDismissed: true, lastRunSummary: null, powersFtueSeen: true
});
const HIDE = `.crn-host, [data-preview-action], [data-testid="gambit-opportunity-hint"] { display: none !important; }`;

const browser = await chromium.launch({
    headless: true,
    args: ['--enable-begin-frame-control', '--run-all-compositor-stages-before-draw', '--disable-new-content-rendering-timeout',
        '--disable-threaded-animation', '--disable-threaded-scrolling', '--disable-checker-imaging',
        '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', `--force-device-scale-factor=${DPR}`]
});
const ctx = await browser.newContext({ viewport: { width: 540, height: 960 }, deviceScaleFactor: DPR, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
page.on('crash', () => { console.error('PAGE CRASHED'); process.exit(2); });
await page.addInitScript(([k, v]) => localStorage.setItem(k, v), ['memory-dungeon-save-data', SAVE]);
// Math.random is the one clock-free source of randomness the page has (the run itself is seeded by
// the share key); replace it with a seeded PRNG so a take is the same take every time.
await page.addInitScript((seed) => {
    let s = seed >>> 0;
    Math.random = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}, Number(args.seed ?? 20260919));
await page.goto(BASE);
await page.addStyleTag({ content: HIDE });
if (args.plate) {
    // Artwork behind the board: the game's scene layer, replaced by a generated plate and lifted.
    const b64 = fs.readFileSync(args.plate).toString('base64');
    const mime = args.plate.endsWith('.png') ? 'image/png' : 'image/webp';
    await page.addStyleTag({ content: `[class*="stageBackdrop"] { background-image: url(data:${mime};base64,${b64}) !important; opacity: ${args.plateOpacity ?? 0.6} !important; filter: saturate(1.0) contrast(1.05) !important; }` });
}
const intro = page.getByRole('dialog', { name: /startup relic intro/i });
for (let i = 0; i < 60; i++) {
    if (await intro.isVisible().catch(() => false)) await intro.press('Escape').catch(() => {});
    if (await page.locator('[data-e2e-menu-pointer="interactive"]').count()) break;
    await page.waitForTimeout(250);
}

const cdp = await ctx.newCDPSession(page);
await cdp.send('HeadlessExperimental.enable');
// The BeginFrame timestamps and the virtual clock share one base: CSS animations (the caption,
// the floater, the colophon) take their start time from the document clock and their progress
// from the frame time, so a frame time behind the clock leaves every animation on its first keyframe.
// The base is a constant, not Date.now(): with a per-run base every (now - start) is computed on
// floats of a different magnitude, the last bits differ, and card edges land on different sub-pixels
// from one take to the next (measured: 1e-11 rect noise, ~1 % of pixels off by up to 90/255).
const base = Number(args.epoch ?? 1_700_000_000_000);
await cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pause', initialVirtualTime: base / 1000 });
const dt = 1000 / FPS;
let ticks = base;
let frame = 0;          // recorded frame index
let gameMs = 0;         // virtual ms elapsed since capture start
const marks = [];
const t0 = Date.now();

// One frame of virtual time: grant a budget of exactly 1/fps and wait until the renderer has spent
// it (timers, rAF and Date/performance clocks all advance by that much), then composite the frame.
// Granting the next budget before the last expired would drop the unspent remainder, which is how
// a 600-frame take once advanced the game by a single second.
const advance = () => new Promise((resolve, reject) => {
    const onExpired = () => { cdp.off('Emulation.virtualTimeBudgetExpired', onExpired); resolve(); };
    cdp.on('Emulation.virtualTimeBudgetExpired', onExpired);
    cdp.send('Emulation.setVirtualTimePolicy', { policy: 'pauseIfNetworkFetchesPending', budget: dt }).catch(reject);
});
const step = async (record) => {
    await advance();
    ticks += dt;
    gameMs += dt;
    const r = await cdp.send('HeadlessExperimental.beginFrame', {
        frameTimeTicks: ticks, interval: dt, noDisplayUpdates: !record, screenshot: record ? { format: 'jpeg', quality: QUALITY } : undefined
    });
    if (record) {
        if (!r.screenshotData) throw new Error(`no pixels for frame ${frame}`);
        fs.writeFileSync(path.join(OUT, 'frames', `f${String(frame).padStart(5, '0')}.jpg`), Buffer.from(r.screenshotData, 'base64'));
        frame++;
        if (frame % 60 === 0) console.log(`frame ${frame}  (${((Date.now() - t0) / 1000).toFixed(0)} s wall)`);
    }
};

const api = {
    page, fps: FPS, dpr: DPR, args,
    frames: async (n) => { for (let i = 0; i < n; i++) await step(true); return frame; },
    skip: async (seconds) => { for (let i = 0; i < Math.round(seconds * FPS); i++) await step(false); },
    until: async (pred, maxSeconds, record) => {
        for (let i = 0; i < Math.round(maxSeconds * FPS); i++) {
            if (await pred(await api.state())) return true;
            await step(record);
        }
        return false;
    },
    mark: (label, extra = {}) => { marks.push({ label, frame, t: frame / FPS, gameMs: Math.round(gameMs), ...extra }); console.log(`  mark ${label} @ frame ${frame}`); },
    state: () => page.evaluate(() => ({
        memorize: document.querySelector('[data-testid=run-shell]')?.getAttribute('data-memorize'),
        tier: document.querySelector('[data-testid=run-shell]')?.getAttribute('data-chain-tier'),
        clear: !!document.querySelector('[data-testid=floor-clear-beat]'),
        floor: document.querySelector('[data-testid=hud-floor]')?.textContent ?? '',
        hud: !!document.querySelector('[data-testid=game-hud]'),
        score: document.querySelector('[data-testid=hud-score]')?.textContent ?? ''
    })),
    rectOf: (cell) => page.evaluate((c) => { const r = window.__e2eGetTileClientRectAtGrid1?.(c[0], c[1]); const f = (v) => Math.round(v * 1000) / 1000; return r ? { x: f(r.left + r.width / 2), y: f(r.top + r.height / 2), w: f(r.width), h: f(r.height) } : null; }, cell),
    pick: (cell) => page.evaluate((c) => window.__e2ePickTileAtGrid1(c[0], c[1]), cell),
    readPairs: () => page.evaluate(() => {
        const w = window; const by = new Map();
        for (let r = 1; r <= 8; r++) for (let c = 1; c <= 8; c++) {
            const id = w.__e2eGetTileIdAtGrid1?.(r, c);
            if (id && /-[AB]$/.test(id) && w.__e2eGetTileStateAtGrid1(r, c) === 'hidden') {
                const k = id.replace(/-[AB]$/, ''); by.set(k, [...(by.get(k) || []), [r, c]]);
            }
        }
        return [...by.values()].filter((v) => v.length >= 2);
    }),
    hide: () => page.addStyleTag({ content: HIDE })
};

const scenario = await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'scenarios', `${args.scenario}.mjs`)).href);
await scenario.run(api);
fs.writeFileSync(path.join(OUT, 'marks.json'), JSON.stringify(marks, null, 2));
fs.writeFileSync(path.join(OUT, 'capture.json'), JSON.stringify({ fps: FPS, dpr: DPR, frames: frame, width: 540 * DPR, height: 960 * DPR, scenario: args.scenario, runKey: args.runKey ?? null, epoch: base, seed: Number(args.seed ?? 20260919), plate: args.plate ? path.basename(args.plate) : null, plateOpacity: args.plateOpacity ?? null, quality: QUALITY }, null, 2));
console.log(`captured ${frame} frames at ${FPS} fps (${(frame / FPS).toFixed(2)} s) in ${((Date.now() - t0) / 1000).toFixed(0)} s wall`);
await browser.close();
