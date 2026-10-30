/**
 * The deep game's cues at their measured levels (DGE-030, 2026-10-24; re-measured on the samples
 * 2026-10-27). Each cue is the game's own code, rendered into an OfflineAudioContext behind the shared
 * context's seam, its delayed notes run at their scheduled times, with the recorded samples loaded as a
 * run plays them. Its loudest 50 ms is held to a band set against the flip, the sound a player hears on
 * every tile: the boss cues level with it, the frequent ones under it but heard, and nothing clipping
 * when every cue lands on one turn.
 */
import { expect, test } from '@playwright/test';

interface Level {
    peakDb: number;
    loudestRmsDb: number;
    clipped: number;
    lengthSec: number;
}

test('the deep game cues sit in their measured bands', async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/', { timeout: 180_000 });
    const rows = await page.evaluate(async () => {
        const sfx = await import('/src/renderer/audio/gameSfx.ts');
        const ctxMod = await import('/src/renderer/audio/webAudioContext.ts');
        const game = await import('/src/shared/game.ts');
        // The flip, the match and the rest play their recorded samples once loaded and a synth tone until then,
        // and the two paths differ by ten decibels for a plain match (DGE-030 measured the synth one by
        // accident). Measure the samples, as a run plays them: on a cold dev server the loader's per-file
        // timeout drops takes, so load again until the ones the bands read are there, and fail rather than
        // measure the synth fallback. The buffers outlive the real context each render closes.
        const sampled = await import('/src/renderer/audio/sampledSfx.ts');
        const needed = ['flip', 'match-tier-low', 'match-tier-mid', 'match-tier-high', 'shuffle-full'] as const;
        let loaded = false;
        for (let attempt = 0; attempt < 5 && !loaded; attempt += 1) {
            if (attempt > 0) sampled.resetSampledSfxForTests();
            await sampled.preloadSampledSfx();
            loaded = needed.every((key) => sampled.tryPlaySampled(key, 0.002));
            sampled.silenceAllSampleVoices();
        }
        if (!loaded) throw new Error('the samples the bands read never loaded');
        const rate = 48_000;
        const realSetTimeout = globalThis.setTimeout;
        const realAudioContext = window.AudioContext;
        const render = async (play: () => void) => {
            const off = new OfflineAudioContext(1, rate * 3, rate);
            let now = 0;
            const proxy = new Proxy(off, {
                get(target, key) {
                    if (key === 'currentTime') return now;
                    if (key === 'state') return 'running';
                    const value = Reflect.get(target, key, target);
                    return typeof value === 'function' ? value.bind(target) : value;
                }
            });
            ctxMod.resetSharedAudioContextForTests();
            (window as unknown as { AudioContext: unknown }).AudioContext = function () { return proxy; };
            const queue: { fn: () => void; at: number }[] = [];
            (globalThis as unknown as { setTimeout: unknown }).setTimeout = (fn: () => void, ms?: number) => { queue.push({ fn, at: now + (ms ?? 0) / 1000 }); return 0; };
            play();
            for (let guard = 0; queue.length > 0 && guard < 200; guard += 1) {
                queue.sort((a, b) => a.at - b.at);
                const next = queue.shift()!;
                if (next.at > 2.9) continue;
                now = next.at;
                next.fn();
            }
            globalThis.setTimeout = realSetTimeout;
            window.AudioContext = realAudioContext;
            ctxMod.resetSharedAudioContextForTests();
            const data = (await off.startRendering()).getChannelData(0);
            let peak = 0, clipped = 0, last = 0, maxWindow = 0;
            for (let i = 0; i < data.length; i += 1) {
                const a = Math.abs(data[i]!);
                if (a > peak) peak = a;
                if (a >= 1) clipped += 1;
                if (a > 0.001) last = i;
            }
            const win = rate / 20;
            for (let s = 0; s + win <= data.length; s += win / 2) {
                let sum = 0;
                for (let i = s; i < s + win; i += 1) sum += data[i]! * data[i]!;
                maxWindow = Math.max(maxWindow, Math.sqrt(sum / win));
            }
            const db = (v: number) => (v > 0 ? Math.round(20 * Math.log10(v) * 10) / 10 : -999);
            return { peakDb: db(peak), loudestRmsDb: db(maxWindow), clipped, lengthSec: Math.round((last / rate) * 100) / 100 };
        };
        const run = game.createNewRun(0, { gameMode: 'endless', runSeed: 7 });
        const held = (n: number) => ({ ...run, heldSeedIds: Array.from({ length: n }, (_, i) => `h${i}`) });
        const deep = (key: string, before = run) => () => sfx.playDeepGameSfx(before, { ...before, [key]: 1 }, 1);
        const cases: Record<string, () => void> = {
            'hold_release (2 held)': deep('holdsReleasedThisFloor', held(2)),
            'hold_release (24 held)': deep('holdsReleasedThisFloor', held(24)),
            warden_redeal: deep('wardenRedealsThisFloor'),
            keeper_swap: deep('keeperSwapsThisFloor'),
            cartographer_turn: deep('cartographerTurnsThisFloor'),
            spiral_seal: deep('spiralRingsSealedThisFloor'),
            sleeper_wake: deep('sleepersWokenThisFloor'),
            mask_drop: deep('masksDroppedThisFloor'),
            wanderer_step: deep('wandererStepsThisFloor'),
            dread_tier: () => sfx.playDeepGameSfx(run, { ...run, board: { ...run.board!, level: 2 }, dreadRagingFloors: 40, dreadWildFloors: 40 }, 1),
            'all eight at once': () => sfx.playDeepGameSfx(run, { ...run, holdsReleasedThisFloor: 1, wardenRedealsThisFloor: 1, keeperSwapsThisFloor: 1, cartographerTurnsThisFloor: 1, spiralRingsSealedThisFloor: 1, sleepersWokenThisFloor: 1, masksDroppedThisFloor: 1, wandererStepsThisFloor: 1 }, 1),
            '(baseline) flip': () => sfx.playFlipSfx(1),
            '(baseline) match': () => sfx.playMatchSfx(1, 1),
            '(baseline) match, chain 6': () => sfx.playMatchSfx(1, 6),
            '(baseline) match, chain 8': () => sfx.playMatchSfx(1, 8),
            '(baseline) match, chain 11': () => sfx.playMatchSfx(1, 11),
            '(baseline) shuffle': () => sfx.playShuffleSfx(1),
            '(baseline) floor clear': () => sfx.playFloorClearSfx(1),
            '(baseline) power arm': () => sfx.playPowerArmSfx(1)
        };
        const out: Record<string, unknown> = {};
        for (const [name, play] of Object.entries(cases)) out[name] = await render(play);
        return out;
    });
    const level = (name: string): Level => rows[name] as Level;
    // Rendered the same way, the baselines are where the band is: a cue that drifts is a cue that moved.
    // The bands read the flip, the sound on every tile, within half a decibel on either path. Measured on the
    // samples (2026-10-30): flip -24.1, shuffle -23.5. The match takes were out of line with it (2026-10-27):
    // a plain match -32.7 and chain 11 -27.5, so a run's first matches were quieter than the flips that led to
    // them and the ladder fell at chain 11. With the plain take's lead-in trimmed and both given a manifest
    // gain, the first rung of each take (chains 1, 6 and 11) measures -24.4, -21.1 and -22.4.
    const flip = level('(baseline) flip').loudestRmsDb;
    expect(flip).toBeGreaterThan(-28);
    expect(flip).toBeLessThan(-20);
    for (const rung of ['(baseline) match', '(baseline) match, chain 6', '(baseline) match, chain 11']) {
        const offset = level(rung).loudestRmsDb - flip;
        expect(offset, `${rung} at ${offset.toFixed(1)} dB from a flip`).toBeGreaterThanOrEqual(-3);
        expect(offset, `${rung} at ${offset.toFixed(1)} dB from a flip`).toBeLessThanOrEqual(5);
    }
    const bands: Record<string, [number, number]> = {
        // The Hold's payoff: level with a flip, give or take (+0.9 measured).
        'hold_release (24 held)': [-2, 5],
        // The boss and Dread cues: in the flip's band (-3.9 to +0.1 measured).
        warden_redeal: [-5, 4],
        keeper_swap: [-5, 4],
        cartographer_turn: [-6, 4],
        spiral_seal: [-5, 4],
        dread_tier: [-5, 4],
        // Every few turns: under it, and still heard (-4.9, -10.2 and -13.2 measured).
        sleeper_wake: [-8, -1],
        mask_drop: [-13, -6],
        wanderer_step: [-16, -8]
    };
    for (const [name, [low, high]] of Object.entries(bands)) {
        const offset = level(name).loudestRmsDb - flip;
        expect(offset, `${name} at ${offset.toFixed(1)} dB from a flip`).toBeGreaterThanOrEqual(low);
        expect(offset, `${name} at ${offset.toFixed(1)} dB from a flip`).toBeLessThanOrEqual(high);
    }
    for (const [name, row] of Object.entries(rows)) expect((row as Level).clipped, name).toBe(0);
    expect(level('all eight at once').peakDb).toBeLessThan(-6);
});
