/**
 * The deep game's cues at their measured levels (DGE-030, 2026-10-24). Each cue is the game's own
 * code, rendered into an OfflineAudioContext behind the shared context's seam, its delayed notes run
 * at their scheduled times. Its loudest 50 ms is held to a band set against a match, a flip and a
 * shuffle rendered the same way: the boss cues in their band, the frequent ones under it but heard,
 * and nothing clipping when every cue lands on one turn.
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
            '(baseline) match, chain 8': () => sfx.playMatchSfx(1, 8),
            '(baseline) shuffle': () => sfx.playShuffleSfx(1),
            '(baseline) floor clear': () => sfx.playFloorClearSfx(1),
            '(baseline) power arm': () => sfx.playPowerArmSfx(1)
        };
        const out: Record<string, unknown> = {};
        for (const [name, play] of Object.entries(cases)) out[name] = await render(play);
        return out;
    });
    const level = (name: string): Level => rows[name] as Level;
    const match = level('(baseline) match').loudestRmsDb;
    // Rendered the same way, the baselines are where the band is: a cue that drifts is a cue that moved.
    expect(match).toBeGreaterThan(-26);
    expect(match).toBeLessThan(-18);
    const bands: Record<string, [number, number]> = {
        // The Hold's payoff: level with a match, give or take.
        'hold_release (24 held)': [-4, 3],
        // The boss and Dread cues: in the match's band.
        warden_redeal: [-7, 2],
        keeper_swap: [-7, 2],
        cartographer_turn: [-8, 2],
        spiral_seal: [-7, 2],
        dread_tier: [-7, 2],
        // Every few turns: under it, and still heard.
        sleeper_wake: [-10, -3],
        mask_drop: [-15, -8],
        wanderer_step: [-18, -10]
    };
    for (const [name, [low, high]] of Object.entries(bands)) {
        const offset = level(name).loudestRmsDb - match;
        expect(offset, `${name} at ${offset.toFixed(1)} dB from a match`).toBeGreaterThanOrEqual(low);
        expect(offset, `${name} at ${offset.toFixed(1)} dB from a match`).toBeLessThanOrEqual(high);
    }
    for (const [name, row] of Object.entries(rows)) expect((row as Level).clipped, name).toBe(0);
    expect(level('all eight at once').peakDb).toBeLessThan(-6);
});
