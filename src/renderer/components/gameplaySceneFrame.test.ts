import { describe, expect, it } from 'vitest';
import { COMBO_HEAT_THEMES } from '../../shared/combo-heat-rules';
import { REALM_IDS, type RealmId } from '../../shared/contracts';
import { makePair, makeRun } from '../../shared/test/game-fixtures';
import { SCENE_SPRITES } from '../assets/ui/sprites';
import { composeGameplayScene, GAMEPLAY_EYES_EVERY_MS, GAMEPLAY_EYES_LAST_MS, GAMEPLAY_SPIDER_EVERY_MS, GAMEPLAY_SPIDER_LASTS_MS, goldCoinDraws, SCENE_RING, type GameplayFrameInput } from './gameplaySceneFrame';
import { floorForeshortening, goldCoinPath, goldCoinPose, goldCoinView, GOLD_PILE_MAX_COINS, GOLD_RAIN_FLOOR, GOLD_RAIN_MAX_COINS, type GoldCoin } from './goldRain';
import { sceneRingLevels, sceneTorchFlarePeak } from './gameplaySceneLevels';
import { createSceneClock, fixedSceneClock, sceneOccurrence } from './sceneClock';
import { deriveSceneMood, type SceneMood } from './sceneMood';
import { findSceneDraw, sceneDrawIds, type SceneDraw, type SceneImageDraw } from './scenePaint';
import { RING_MOTE_COUNT } from './sceneSpriteClocks';
import type { RealmRoomArt } from './realmRoomArt';

const flames = SCENE_SPRITES.gameplayFlames;
const rest: GameplayFrameInput = {
    fill: 0,
    memorize: false,
    pulse: 'none',
    pulseKey: null,
    feverKey: null,
    cleared: false,
    imminent: false,
    comboHeat: 0,
    comboHueDeg: 0,
    mood: undefined,
    runSeed: 7,
    tier: 'full',
    base: 0.42
};
type Since = Record<string, number>;
const frame = (over: Partial<GameplayFrameInput> = {}, t = 1000, since: Since = {}) =>
    composeGameplayScene({ ...rest, ...over }, fixedSceneClock(t, { still: over.tier === 'still', since }));
const alphaOf = (draws: readonly SceneDraw[], id: string): number => draws.find((draw) => draw.id === id)?.alpha ?? 0;
const flamesOf = (draws: readonly SceneDraw[]) => draws.filter((draw): draw is SceneImageDraw => draw.kind === 'image' && draw.id.startsWith('flame-'));
const count = (draws: readonly SceneDraw[], prefix: string) => draws.filter((draw) => draw.id.startsWith(prefix) && draw.alpha > 0.004).length;

const theme = (id: string) => COMBO_HEAT_THEMES.find((candidate) => candidate.id === id)!;
const NO_REALM_ROOMS = Object.fromEntries(REALM_IDS.map((realm) => [realm, { base: '', glows: {}, sprites: [] }])) as unknown as Record<RealmId, RealmRoomArt>;
const mood = (temper: string, over: Partial<Parameters<typeof deriveSceneMood>[0]> = {}): SceneMood =>
    deriveSceneMood({
        combo: 0,
        latestLoss: null,
        run: makeRun([...makePair('a', 'A'), ...makePair('b', 'B')]),
        storeOpen: false,
        temper: theme(temper),
        ...over
    });

describe('composeGameplayScene', () => {
    it('paints the room as a dark base and a light per family, each added to it', () => {
        const draws = frame();
        const ids = sceneDrawIds(draws);
        for (const id of ['base', 'torchLightL', 'torchLightR', 'ringLight', 'torchGlow', 'runeGlow', 'ringGlow']) {
            expect(ids).toContain(id);
        }
        // Stone first, then what lights it.
        expect(ids[0]).toBe('base');
        expect(alphaOf(draws, 'base')).toBe(0.42);
        for (const id of ['torchLightL', 'torchLightR', 'ringLight', 'torchGlow', 'runeGlow', 'ringGlow']) {
            expect(findSceneDraw(draws, id)!.blend).toBe('lighter');
        }
        // The other rooms and the weather are in the list and show nothing.
        for (const id of ['shop', 'void', 'snow', 'wet', 'frost', 'ringPulse', 'torchFlare', 'feverArrival', 'peril']) {
            expect(alphaOf(draws, id)).toBe(0);
        }
    });

    it('warms the ring with the chain, continuously: every step of fill lifts its light and its glow and turns it', () => {
        let last = frame({ fill: 0 });
        for (let step = 1; step <= 10; step += 1) {
            const next = frame({ fill: step / 10 });
            expect(alphaOf(next, 'ringLight')).toBeGreaterThan(alphaOf(last, 'ringLight'));
            expect(alphaOf(next, 'ringGlow')).toBeGreaterThan(alphaOf(last, 'ringGlow'));
            expect(findSceneDraw(next, 'ringGlow')!.filter!.hueDeg!).toBeLessThanOrEqual(findSceneDraw(last, 'ringGlow')!.filter!.hueDeg!);
            last = next;
        }
        expect(alphaOf(frame({ fill: 0.5 }), 'ringLight')).toBe(sceneRingLevels(0.5).light);
        expect(findSceneDraw(frame({ fill: 1 }), 'ringGlow')!.filter).toEqual({ hueDeg: -40, saturate: 1.4 });
        // The motes it throws up rise from nothing at rest to a full drift at Fever, on the floor round the ring.
        expect(count(frame({ fill: 0 }), 'ring-mote-')).toBe(0);
        const motes = frame({ fill: 1 }).filter((draw): draw is SceneImageDraw => draw.kind === 'image' && draw.id.startsWith('ring-mote-'));
        expect(motes).toHaveLength(RING_MOTE_COUNT);
        for (const mote of motes) {
            const cx = mote.rect!.x + mote.rect!.w / 2;
            expect(Math.abs(cx - SCENE_RING.cx)).toBeLessThanOrEqual(SCENE_RING.rx + 0.03);
            expect(mote.rect!.y).toBeGreaterThan(0.4);
            expect(mote.rect!.y).toBeLessThan(0.86);
        }
    });

    it('holds the painted torchlight still while the chain moves the flames themselves', () => {
        const cold = frame({ fill: 0 });
        const hot = frame({ fill: 1 });
        for (const id of ['torchLightL', 'torchLightR', 'torchGlow']) {
            // Light a painted flame throws on a wall cannot honestly grow.
            expect(alphaOf(hot, id)).toBe(alphaOf(cold, id));
            expect(alphaOf(cold, id)).toBe(0.82);
        }
        expect(flamesOf(hot)[0]!.scaleY!).toBeGreaterThan(flamesOf(cold)[0]!.scaleY!);
    });

    it('never moves the torchlight on a clock of its own: full-room brightness changes read as the screen flashing', () => {
        const a = frame({}, 0);
        for (let t = 33; t < 12_000; t += 33) {
            const b = frame({}, t);
            for (const id of ['base', 'torchLightL', 'torchLightR', 'torchGlow', 'ringLight', 'ringGlow']) {
                expect(alphaOf(b, id)).toBe(alphaOf(a, id));
            }
        }
    });

    it('burns the fire harder the better the run is going: taller, faster, more sparks', () => {
        const run = (fill: number, ms: number) => {
            const clock = createSceneClock();
            composeGameplayScene({ ...rest, fill }, clock.frame(0));
            return composeGameplayScene({ ...rest, fill }, clock.frame(ms));
        };
        const sparks = (draws: readonly SceneDraw[]) => draws.filter((draw) => draw.id.startsWith('ember-flame-')).reduce((sum, draw) => sum + draw.alpha, 0);
        expect(flamesOf(frame({ fill: 1 }))[0]!.scaleY!).toBeGreaterThan(flamesOf(frame({ fill: 0 }))[0]!.scaleY!);
        expect(sparks(frame({ fill: 1 }))).toBeGreaterThan(sparks(frame({ fill: 0 })));
        // Faster: over the same 200ms a hot fire has run further through its flipbook than a cold one.
        const cold = flamesOf(run(0, 200)).map((flame) => flame.frame!.index);
        const hot = flamesOf(run(1, 200)).map((flame) => flame.frame!.index);
        expect(hot).not.toEqual(cold);
        // A flame grows up the wall from its foot, never outward.
        for (const flame of flamesOf(frame({ fill: 1 }))) {
            expect(flame.originY).toBe(1);
            expect(flame.scaleX).toBe(1);
        }
    });

    it('leans the room toward the pair that would land a rung, and only that pair', () => {
        const steady = frame({ fill: 0.6 });
        const drawing = frame({ fill: 0.6, imminent: true });
        // The fire draws breath: pulled in, with fewer sparks.
        expect(flamesOf(drawing)[0]!.scaleY!).toBeLessThan(flamesOf(steady)[0]!.scaleY!);
        expect(flamesOf(drawing)[0]!.scaleY!).toBeGreaterThan(flamesOf(steady)[0]!.scaleY! * 0.9);
        // And nothing else in the room moves for it.
        for (const id of ['base', 'ringLight', 'ringGlow', 'torchGlow', 'runeGlow']) {
            expect(alphaOf(drawing, id)).toBe(alphaOf(steady, id));
        }
    });

    it('cuts the six torch flames out as sprites that play on their own clocks, with sparks', () => {
        const draws = frame({}, 4000);
        const sprites = flamesOf(draws);
        expect(sprites).toHaveLength(6);
        sprites.forEach((sprite, index) => {
            const def = flames.sprites[index]!;
            expect(sprite.src).toBe(def.sheet);
            expect(sprite.rect).toEqual({ x: def.x, y: def.y, w: def.w, h: def.h });
            expect(sprite.frame!.count).toBe(def.frames);
            expect(sprite.blend).toBe('source-over');
        });
        // Six torches on a wall never move together.
        expect(new Set(sprites.map((sprite) => sprite.frame!.index)).size).toBeGreaterThan(2);
        expect(count(draws, 'ember-flame-')).toBeGreaterThan(6);
    });

    it('flashes the floor on a break, harder the further the chain has come, and restarts for a second break', () => {
        // No break, no flash.
        expect(alphaOf(frame({ fill: 0.5 }), 'ringPulse')).toBe(0);
        // A break 60ms old is near its peak; the peak grows with the chain.
        const early = alphaOf(frame({ fill: 0.2, pulse: 'clean', pulseKey: 'a' }, 1000, { pulse: 60 }), 'ringPulse');
        const late = alphaOf(frame({ fill: 0.9, pulse: 'clean', pulseKey: 'a' }, 1000, { pulse: 60 }), 'ringPulse');
        expect(early).toBeGreaterThan(0.2);
        expect(late).toBeGreaterThan(early);
        // And it settles.
        expect(alphaOf(frame({ fill: 0.9, pulse: 'clean', pulseKey: 'a' }, 1000, { pulse: 600 }), 'ringPulse')).toBeLessThan(late * 0.3);
        expect(alphaOf(frame({ fill: 0.9, pulse: 'clean', pulseKey: 'a' }, 1000, { pulse: 800 }), 'ringPulse')).toBe(0);
        // Fever's lasts longer.
        expect(alphaOf(frame({ fill: 0.9, pulse: 'fever', pulseKey: 'a' }, 1000, { pulse: 800 }), 'ringPulse')).toBeGreaterThan(0);

        // Two breaks of the same tier in a row each get their flash: the key restarts it.
        const clock = createSceneClock();
        let now = 0;
        // The clock will not jump over a long gap (a sleeping tab), so time is walked, as frames do.
        const after = (ms: number, pulseKey: string | null): number => {
            let level = 0;
            for (const end = now + ms; now < end; ) {
                now += Math.min(50, end - now);
                level = alphaOf(composeGameplayScene({ ...rest, fill: 0.5, pulse: pulseKey ? 'clean' : 'none', pulseKey }, clock.frame(now)), 'ringPulse');
            }
            return level;
        };
        expect(after(100, null)).toBe(0);
        expect(after(100, 'first')).toBeGreaterThan(0.3);
        expect(after(1100, 'first')).toBe(0);
        expect(after(100, 'second')).toBeGreaterThan(0.3);
    });

    it('flares the torches on a break, harder up the tiers, and never under reduce motion', () => {
        let last = 0;
        for (const pulse of ['pop', 'clean', 'sharp', 'fever'] as const) {
            const flare = alphaOf(frame({ pulse, pulseKey: pulse }, 1000, { pulse: 70 }), 'torchFlare');
            expect(flare).toBeGreaterThan(last);
            expect(flare).toBeLessThanOrEqual(sceneTorchFlarePeak(pulse));
            last = flare;
        }
        expect(alphaOf(frame({ pulse: 'fever', pulseKey: 'k', tier: 'still' }), 'torchFlare')).toBe(0);
        // Under reduce motion the floor still says a break happened: it is lit, not flashed.
        expect(alphaOf(frame({ fill: 0.5, pulse: 'clean', pulseKey: 'k', tier: 'still' }), 'ringPulse')).toBe(sceneRingLevels(0.5).pulsePeak);
    });

    it('exhales when the floor is cleared: the ring swells and settles, the torches gutter and recover', () => {
        const before = frame({ fill: 0.5 });
        const swell = frame({ fill: 0.5, cleared: true }, 1000, { cleared: 450 });
        const settled = frame({ fill: 0.5, cleared: true }, 1000, { cleared: 5000 });
        expect(alphaOf(swell, 'ringGlow')).toBeGreaterThan(alphaOf(before, 'ringGlow') * 1.3);
        expect(alphaOf(settled, 'ringGlow')).toBeGreaterThan(alphaOf(before, 'ringGlow'));
        expect(alphaOf(settled, 'ringGlow')).toBeLessThan(alphaOf(swell, 'ringGlow'));
        expect(alphaOf(frame({ cleared: true }, 1000, { cleared: 550 }), 'torchGlow')).toBeLessThan(0.6);
        expect(alphaOf(frame({ cleared: true }, 1000, { cleared: 5000 }), 'torchGlow')).toBe(0.82);
    });

    it('breathes with the player while the board is memorised', () => {
        const levels = new Set<number>();
        for (let t = 0; t < 3600; t += 300) {
            levels.add(alphaOf(frame({ memorize: true }, t), 'ringGlow'));
        }
        expect(levels.size).toBeGreaterThan(4);
        expect(Math.min(...levels)).toBeGreaterThanOrEqual(sceneRingLevels(0).glow);
        expect(Math.max(...levels)).toBeLessThanOrEqual(sceneRingLevels(0).glow * 1.23);
    });

    it('flashes the room once when the run reaches Fever, and never while it stays there', () => {
        expect(alphaOf(frame({ fill: 1 }), 'feverArrival')).toBe(0);
        expect(alphaOf(frame({ fill: 1, feverKey: 'turn-9' }, 1000, { fever: 60 }), 'feverArrival')).toBeGreaterThan(0.5);
        // Sitting at Fever with the same key: the flash has long since gone.
        expect(alphaOf(frame({ fill: 1, feverKey: 'turn-9' }, 1000, { fever: 5000 }), 'feverArrival')).toBe(0);
        // A sudden change in brightness: reduce motion never shows it at all.
        expect(alphaOf(frame({ fill: 1, feverKey: 'turn-9', tier: 'still' }, 1000, { fever: 60 }), 'feverArrival')).toBe(0);
    });

    it('holds still under reduce motion: the lit room, every flame on its first frame, nothing adrift', () => {
        const draws = frame({ fill: 0.5, tier: 'still' });
        const ids = sceneDrawIds(draws);
        expect(ids).toEqual(expect.arrayContaining(['base', 'torchLightL', 'torchLightR', 'ringLight', 'torchGlow', 'runeGlow', 'ringGlow']));
        for (const moving of ['mist', 'floor-mist', 'bat', 'spider', 'stormFlash']) {
            expect(ids).not.toContain(moving);
        }
        for (const prefix of ['ember-', 'ring-mote-', 'dust-', 'drip-', 'drift-', 'torch-smoke-']) {
            expect(count(draws, prefix)).toBe(0);
        }
        for (const flame of flamesOf(draws)) {
            expect(flame.frame!.index).toBe(0);
            expect(flame.scaleY).toBe(1);
        }
        expect(composeGameplayScene({ ...rest, fill: 0.5, tier: 'still' }, fixedSceneClock(77_000, { still: true }))).toEqual(draws);
    });

    it('gives a phone the same room: every light pass, the mist and the flames, with thinner specks', () => {
        const full = frame({ fill: 1 });
        const lean = frame({ fill: 1, tier: 'lean' });
        // The lean tier used to drop the three rendered light passes and the mist, because each was
        // a blended layer the size of the screen. In one canvas they cost a phone nothing extra.
        for (const id of ['base', 'torchLightL', 'torchLightR', 'ringLight', 'torchGlow', 'runeGlow', 'ringGlow', 'mist']) {
            expect(alphaOf(lean, id)).toBe(alphaOf(full, id));
        }
        expect(flamesOf(lean)).toHaveLength(6);
        expect(count(lean, 'ember-flame-')).toBeGreaterThan(0);
        expect(count(lean, 'dust-')).toBeLessThan(count(full, 'dust-'));
        expect(count(lean, 'ring-mote-')).toBeLessThan(count(full, 'ring-mote-'));
    });

    it('has the room lived in: mist, dust in the torchlight, smoke off the big torches, water off the vault', () => {
        const draws = frame();
        expect(findSceneDraw(draws, 'mist', 'fog')!.mask).toMatchObject({ kind: 'ellipse', cx: 0.5, cy: 0.52 });
        expect(findSceneDraw(draws, 'floor-mist', 'fog')!.mask.kind).toBe('band');
        expect(count(draws, 'dust-')).toBeGreaterThan(8);
        expect(draws.filter((draw) => draw.id.startsWith('torch-smoke-'))).toHaveLength(4);
        expect(draws.filter((draw) => draw.id.startsWith('torch-pool-'))).toHaveLength(2);
        // Over a couple of minutes water comes off the vault and lands.
        let drops = 0;
        let ripples = 0;
        for (let t = 0; t < 120_000; t += 250) {
            const at = frame({}, t);
            drops += count(at, 'drip-drop-');
            ripples += count(at, 'drip-ripple-');
        }
        expect(drops).toBeGreaterThan(5);
        expect(ripples).toBeGreaterThan(5);
    });

    it('lets something look back from the dark now and then, and a spider come down its thread', () => {
        const during = (every: number, lasts: number, seed: number, progress: number): number => {
            for (let t = 0; t < every * 3; t += 20) {
                const occurrence = sceneOccurrence(t, every, lasts, seed);
                if (occurrence && occurrence.progress >= progress) {
                    return t;
                }
            }
            throw new Error('the event never came');
        };
        const watching = frame({}, during(GAMEPLAY_EYES_EVERY_MS, GAMEPLAY_EYES_LAST_MS, 31, 0.3));
        expect(alphaOf(watching, 'eyes-l')).toBeGreaterThan(0.5);
        expect(alphaOf(watching, 'eyes-r')).toBe(alphaOf(watching, 'eyes-l'));
        // They blink.
        expect(alphaOf(frame({}, during(GAMEPLAY_EYES_EVERY_MS, GAMEPLAY_EYES_LAST_MS, 31, 0.47)), 'eyes-l')).toBe(0);

        const hanging = frame({}, during(GAMEPLAY_SPIDER_EVERY_MS, GAMEPLAY_SPIDER_LASTS_MS, 37, 0.45));
        const thread = findSceneDraw(hanging, 'spider-thread', 'line')!;
        const spider = findSceneDraw(hanging, 'spider')!;
        expect(thread.points[0]![1]).toBe(0);
        // The spider is at the end of its thread.
        expect(spider.rect!.y + spider.rect!.h / 2).toBeCloseTo(thread.points[1]![1] + 0.008, 3);
        expect(thread.points[1]![1]).toBeGreaterThan(0.2);
    });

    it('crossfades to the shop and the void as rooms of their own: the dungeon\'s light and flames leave with it', () => {
        const shop = frame({ fill: 0.5, mood: mood('ember', { storeOpen: true }) });
        expect(alphaOf(shop, 'shop')).toBe(0.42);
        expect(alphaOf(shop, 'base')).toBe(0);
        for (const id of ['torchLightL', 'ringLight', 'torchGlow', 'runeGlow', 'ringGlow', 'mist']) {
            expect(alphaOf(shop, id)).toBe(0);
        }
        expect(flamesOf(shop).every((flame) => flame.alpha === 0)).toBe(true);

        // And it is a crossfade: partway through, both rooms are there.
        const clock = createSceneClock();
        composeGameplayScene({ ...rest, mood: mood('ember') }, clock.frame(0));
        const partway = composeGameplayScene({ ...rest, mood: mood('ember', { storeOpen: true }) }, clock.frame(250));
        expect(alphaOf(partway, 'base')).toBeGreaterThan(0.05);
        expect(alphaOf(partway, 'shop')).toBeGreaterThan(0.05);
        expect(alphaOf(partway, 'base') + alphaOf(partway, 'shop')).toBeCloseTo(0.42, 2);
    });

    it('lays the run\'s weather on the room: snow and frost on a frost run, wet stone and flashes in a storm, sparks on an ember run', () => {
        const frost = frame({ mood: mood('frost', { combo: 12 }) });
        expect(alphaOf(frost, 'snow')).toBeGreaterThan(0.5);
        expect(findSceneDraw(frost, 'snow')!.blend).toBeUndefined();
        expect(alphaOf(frost, 'frost')).toBeGreaterThan(0.1);
        expect(findSceneDraw(frost, 'frost')!.blend).toBe('screen');
        expect(findSceneDraw(frost, 'snowGlow')!.filter).toEqual({ blurPx: 7, brightness: 1.4 });
        // The frost grows in from the edges: larger than the plate, centred on it.
        const rect = findSceneDraw(frost, 'frost')!.rect!;
        expect(rect.w).toBeGreaterThan(1);
        expect(rect.x + rect.w / 2).toBeCloseTo(0.5, 6);

        const storm = mood('storm');
        expect(alphaOf(frame({ mood: storm }), 'wet')).toBeGreaterThan(0.2);
        let flashes = 0;
        let dark = 0;
        for (let t = 0; t < 20_000; t += 20) {
            const flash = alphaOf(frame({ mood: storm }, t), 'stormFlash');
            flashes += flash > 0.5 ? 1 : 0;
            dark += flash === 0 ? 1 : 0;
        }
        expect(flashes).toBeGreaterThan(0);
        // Almost always it is not flashing.
        expect(dark).toBeGreaterThan(850);
        expect(sceneDrawIds(frame({ mood: storm, tier: 'still' }))).not.toContain('stormFlash');
        // Lightning comes down through the arches on the same beat: a white core inside a violet glow.
        let struck: ReturnType<typeof frame> | null = null;
        let quiet = 0;
        for (let t = 0; t < 20_000 && !struck; t += 20) {
            const at = frame({ mood: storm }, t);
            if (at.some((draw) => draw.id === 'bolt-0' && draw.alpha > 0.5)) {
                struck = at;
            } else if (!at.some((draw) => draw.id.startsWith('bolt-'))) {
                quiet += 1;
            }
        }
        expect(struck).not.toBeNull();
        expect(quiet).toBeGreaterThan(10);
        const core = findSceneDraw(struck!, 'bolt-0', 'line')!;
        expect(core.blend).toBe('screen');
        expect(core.points.length).toBeGreaterThan(6);
        expect(core.points[0]![1]).toBeLessThan(0.12);
        expect(findSceneDraw(struck!, 'bolt-0-halo', 'line')!.width).toBeGreaterThan(core.width * 5);
        expect(findSceneDraw(struck!, 'bolt-0-halo', 'line')!.alpha).toBeLessThan(core.alpha);
        expect(frame({ mood: storm, tier: 'still' }).some((draw) => draw.id.startsWith('bolt-'))).toBe(false);

        const ember = frame({ mood: mood('ember', { combo: 10 }) }, 3000);
        expect(count(ember, 'drift-')).toBeGreaterThan(20);
        expect(count(frame({ mood: mood('frost') }, 3000), 'drift-')).toBe(0);
    });

    it('rains gold on a payout that lands and stays on the floor, and lies there on a restore and under reduced motion', () => {
        const paid = { ...mood('ember'), goldRain: { key: 'floor:3', coins: 24 } };
        const during = frame({ mood: paid }, 1000, { 'gold-pile:0': 1100 });
        const coins = during.filter((draw): draw is SceneImageDraw => draw.kind === 'image' && /^coin-\d+$/.test(draw.id));
        expect(coins.length).toBeGreaterThan(8);
        expect(coins.length).toBeLessThanOrEqual(24);
        for (const coin of coins) {
            // Metal in the room's light, not a glow: drawn over the stone, a frame of its baked turn.
            expect(coin.blend).toBe('source-over');
            // A frame of the baked coin's turn (`bake_coin.py`).
            expect(coin.frame!.count).toBe(SCENE_SPRITES.goldCoin.sprites[0]!.frames);
            expect(coin.scaleX).toBeUndefined();
            expect(coin.rect!.x).toBeGreaterThan(0);
            expect(coin.rect!.x).toBeLessThan(1);
            // Nothing falls through the floor of the room.
            expect(coin.rect!.y + coin.rect!.h).toBeLessThanOrEqual(GOLD_RAIN_FLOOR.near + 1e-9);
        }
        // They are at different heights: a shower, not a curtain.
        expect(new Set(coins.map((coin) => Math.round(coin.rect!.y * 20))).size).toBeGreaterThan(4);
        // Long after, every coin is still there, lying flat on the floor.
        const after = frame({ mood: paid }, 1000, { 'gold-pile:0': 60_000 }).filter((draw): draw is SceneImageDraw => draw.kind === 'image' && /^coin-\d+$/.test(draw.id));
        expect(after.length).toBe(24);
        for (const coin of after) {
            expect(coin.alpha).toBe(1);
            // Lying flat on the floor: its centre on the floor band.
            const centre = coin.rect!.y + coin.rect!.h / 2;
            expect(centre).toBeGreaterThan(GOLD_RAIN_FLOOR.far - 0.01);
            expect(centre).toBeLessThan(GOLD_RAIN_FLOOR.near + 0.01);
        }
        // Found already lying there (a restore), and under reduced motion: at rest, not falling again.
        const bodies = (draws: readonly SceneDraw[]) => draws.filter((draw) => /^coin-\d+$/.test(draw.id) && draw.alpha > 0.004).length;
        expect(bodies(frame({ mood: paid }))).toBe(24);
        expect(bodies(frame({ mood: paid, tier: 'still' }, 1000, { 'gold-pile:0': 1100 }))).toBe(24);
        // A phone carries half as many.
        expect(count(frame({ mood: paid, tier: 'lean' }, 1000, { 'gold-pile:0': 1100 }), 'coin-')).toBeLessThan(coins.length);
    });

    it('piles every payout of the floor on the floor, the newest kept when the pile is full', () => {
        const pile = [{ key: 'a', coins: 30, slot: 0 }, { key: 'b', coins: 40, slot: 1 }];
        const lying = frame({ mood: { ...mood('ember'), goldRain: pile[1]!, goldPile: pile } }, 1000);
        expect(lying.filter((draw) => /^coin-\d+$/.test(draw.id)).length).toBe(70);
        const huge = Array.from({ length: 6 }, (_, index) => ({ key: `s${index}`, coins: 90, slot: index }));
        const full = frame({ mood: { ...mood('ember'), goldRain: huge[5]!, goldPile: huge } }, 1000);
        expect(full.filter((draw) => /^coin-\d+$/.test(draw.id)).length).toBe(GOLD_PILE_MAX_COINS);
        // The newest shower is all there.
        expect(full.some((draw) => draw.id === `coin-${5 * GOLD_RAIN_MAX_COINS + 89}`)).toBe(true);
    });

    it('rains on the first payout a room sees, not only on the ones after it', () => {
        const driver = createSceneClock();
        const input = (over: Partial<GameplayFrameInput>): GameplayFrameInput => ({
            fill: 0, memorize: false, pulse: 'none', pulseKey: null, feverKey: null, cleared: false, imminent: false,
            comboHeat: 0, comboHueDeg: 0, mood: mood('ember'), runSeed: 1, tier: 'full', base: 1, ...over
        });
        composeGameplayScene(input({}), driver.frame(0));
        const paid = { ...mood('ember'), goldRain: { key: 'bought:miss:1', coins: 18 } };
        composeGameplayScene(input({ mood: paid }), driver.frame(100));
        const falling = composeGameplayScene(input({ mood: paid }), driver.frame(1300));
        expect(count(falling, 'coin-')).toBeGreaterThan(4);
    });

    it('flies a coin like gold: falls tumbling, bounces lower each time, spins down and lies flat in the floor\'s perspective', () => {
        const coin: GoldCoin = { x: 50, delay: 0, duration: 1, depth: 0.4, spin: 3, phase: 0.3 };
        const path = goldCoinPath(coin, GOLD_RAIN_FLOOR);
        expect(path.landS).toBeGreaterThan(0.4);
        expect(path.landS).toBeLessThan(1.2);
        expect(path.restS).toBeGreaterThan(path.landS);
        // Tumbling on the way down: its face turns through the view.
        const turns = new Set<number>();
        for (let s = 0; s < path.landS; s += 0.05) turns.add(Math.round(goldCoinView(goldCoinPose(path, s), GOLD_RAIN_FLOOR).turn * 10));
        expect(turns.size).toBeGreaterThan(4);
        // Off the floor and back: it leaves the floor again after the strike, never as high as it fell
        // from, and the bounces die away (the second half of its settling lower than the first).
        const start = goldCoinPose(path, 0).height;
        const heightsAfter = (from: number, to: number): number[] => {
            const out: number[] = [];
            for (let s = from; s < to; s += 1 / 120) out.push(goldCoinPose(path, s).height);
            return out;
        };
        const mid = (path.landS + path.restS) / 2;
        const early = Math.max(...heightsAfter(path.landS + 0.02, mid));
        const late = Math.max(...heightsAfter(mid, path.restS));
        expect(early).toBeGreaterThan(0.005);
        expect(early).toBeLessThan(start * 0.3);
        expect(late).toBeLessThan(early);
        // At rest: flat on the floor, seen at the floor's own foreshortening, and it stays.
        const rest = goldCoinPose(path, Number.POSITIVE_INFINITY);
        expect(rest.tilt).toBe(0);
        expect(rest.height).toBe(0);
        expect(rest.still).toBe(true);
        const view = goldCoinView(rest, GOLD_RAIN_FLOOR);
        const yFloor = GOLD_RAIN_FLOOR.near + (GOLD_RAIN_FLOOR.far - GOLD_RAIN_FLOOR.near) * rest.depth;
        expect(view.foreshortening).toBeCloseTo(floorForeshortening(yFloor, GOLD_RAIN_FLOOR), 6);
        expect(Math.cos(view.turn * Math.PI)).toBeCloseTo(view.foreshortening, 3);
        const lying = goldCoinDraws(coin, 0, 60, false).find((d) => d.id === 'coin-0') as SceneImageDraw;
        expect(lying.alpha).toBe(1);
        expect(goldCoinDraws(coin, 0, 60, false).some((d) => d.id === 'coinshadow-0')).toBe(true);
        expect(goldCoinDraws(coin, 0, Number.POSITIVE_INFINITY, false).some((d) => d.id === 'coin-0')).toBe(true);
        // A far coin is smaller, and lies flatter (nearer the horizon), than a near one.
        const far = goldCoinDraws({ ...coin, depth: 1 }, 0, 60, false).find((d) => d.id === 'coin-0') as SceneImageDraw;
        const near = goldCoinDraws({ ...coin, depth: 0 }, 0, 60, false).find((d) => d.id === 'coin-0') as SceneImageDraw;
        expect(far.rect!.h).toBeLessThan(near.rect!.h);
        expect(floorForeshortening(GOLD_RAIN_FLOOR.far, GOLD_RAIN_FLOOR)).toBeLessThan(floorForeshortening(GOLD_RAIN_FLOOR.near, GOLD_RAIN_FLOOR));
        // On water it goes in with a ring and sinks to a dim glint, and stays.
        expect(goldCoinDraws(coin, 0, path.landS + 0.2, false, { water: true }).some((d) => d.id === 'coin-0-splash')).toBe(true);
        expect((goldCoinDraws(coin, 0, 30, false, { water: true }).find((d) => d.id === 'coin-0') as SceneImageDraw).alpha).toBeLessThan(0.4);
    });

    it('darkens for a breath on a miss and guts the torches without putting them out', () => {
        const miss = { ...mood('ember'), missKey: 'miss:1' };
        const struck = frame({ mood: miss }, 1000, { miss: 140 });
        const calm = frame({ mood: miss }, 1000, { miss: 5000 });
        expect(alphaOf(struck, 'base')).toBeLessThan(alphaOf(calm, 'base') * 0.6);
        expect(alphaOf(struck, 'torchGlow')).toBeLessThan(alphaOf(calm, 'torchGlow'));
        expect(alphaOf(struck, 'torchGlow')).toBeGreaterThan(0.3);
        expect(flamesOf(struck)).toHaveLength(6);
    });

    it('breathes a red edge and burns the torches low while the bank is empty', () => {
        const peril = frame({ mood: { ...mood('ember'), peril: true } });
        const safe = frame({ mood: mood('ember') });
        expect(alphaOf(peril, 'peril')).toBeGreaterThan(0.5);
        expect(alphaOf(safe, 'peril')).toBe(0);
        expect(alphaOf(peril, 'torchGlow')).toBeLessThan(alphaOf(safe, 'torchGlow'));
        expect(findSceneDraw(peril, 'peril', 'glow')!.stops[0]![1]).toContain('0)');
    });

    it('lights the room\'s fixtures for the relics the run carries', () => {
        const withRelics = (relics: SceneMood['relics']) => frame({ fill: 0.5, mood: { ...mood('ember'), relics } });
        const none = withRelics([]);
        expect(alphaOf(withRelics(['tallow_candle']), 'torchGlow')).toBeGreaterThan(alphaOf(none, 'torchGlow'));
        expect(findSceneDraw(withRelics(['tallow_candle']), 'torchGlow')!.filter).toEqual({ brightness: 1.25, saturate: 1.2 });
        expect(alphaOf(withRelics(['long_look']), 'ringLight')).toBeCloseTo(alphaOf(none, 'ringLight') * 1.35, 6);
        expect(findSceneDraw(withRelics(['gilded_chain']), 'runeGlow')!.filter).toEqual({ hueDeg: 165, saturate: 1.4, brightness: 1.15 });
        expect(findSceneDraw(withRelics(['deep_pockets']), 'ringGlow')!.filter!.hueDeg).toBe(findSceneDraw(none, 'ringGlow')!.filter!.hueDeg! - 20);
    });

    it('paints the chemistry in the room under its lights, and tints the ring\'s light with each element there', () => {
        const run = makeRun([...makePair('a', 'A'), ...makePair('b', 'B')], { realmId: 'ember', realmSecondaryId: 'tide' });
        // In the dungeon ring: the Cinder Deep's own room is painted, so a realm without its art stands in.
        const steam = frame({ mood: mood('ember', { run, realmRoomArt: NO_REALM_ROOMS }) });
        const ids = sceneDrawIds(steam);
        expect(ids).toContain('element-steam');
        expect(ids.indexOf('element-steam')).toBeGreaterThan(ids.indexOf('base'));
        expect(ids.indexOf('element-steam')).toBeLessThan(ids.indexOf('torchLightL'));
        expect(findSceneDraw(steam, 'element-steam')!.src).toContain('bg-gameplay-element-steam-v1.webp');
        expect(ids).toContain('material-ember');
        expect(findSceneDraw(steam, 'material-ember')).toMatchObject({ blend: 'screen', filter: { hueDeg: 100, saturate: 1.35 } });
        // A phone draws the smaller painting.
        expect(findSceneDraw(frame({ mood: mood('ember', { run, realmRoomArt: NO_REALM_ROOMS }), compactArt: true }), 'element-steam')!.src).toContain('-mobile.webp');
        // No chemistry, nothing painted.
        expect(sceneDrawIds(frame({ mood: mood('ember') })).some((id) => id.startsWith('element-'))).toBe(false);
    });

    it('opens a realm floor in its own painted room, its glow on the combo and its chemistry a tint over it', () => {
        const run = makeRun([...makePair('a', 'A'), ...makePair('b', 'B')], { realmId: 'ember', realmSecondaryId: 'tide' });
        const cold = frame({ mood: mood('ember', { run }) });
        const ids = sceneDrawIds(cold);
        expect(findSceneDraw(cold, 'realm')!.src).toContain('bg-gameplay-realm-ember-v1-base');
        expect(findSceneDraw(cold, 'realmGlow-ring')).toMatchObject({ blend: 'lighter' });
        expect(ids).not.toContain('torchLightL');
        expect(ids.indexOf('element-steam')).toBeGreaterThan(ids.indexOf('realmGlow-ring'));
        expect(findSceneDraw(cold, 'element-steam')).toMatchObject({ blend: 'soft-light' });
        expect(alphaOf(frame({ mood: mood('ember', { run }), comboDepth: 3 }), 'realmGlow-ring')).toBeGreaterThan(alphaOf(cold, 'realmGlow-ring'));
    });

    it('keeps every realm room alive, more of it the deeper the chain, halved on a phone and still under reduced motion', () => {
        const signature: Record<RealmId, string> = { frost: 'frost-snow-', ember: 'ember-spark-', tide: 'tide-bubble-', storm: 'storm-rain-', grove: 'grove-spore-' };
        for (const realm of REALM_IDS) {
            const run = makeRun([...makePair('a', 'A'), ...makePair('b', 'B')], { realmId: realm });
            const room = (over: Partial<GameplayFrameInput>) => frame({ mood: mood('ember', { run }), ...over });
            // Batched strokes (the storm's rain) count each thing they carry.
            const life = (draws: readonly SceneDraw[]) =>
                draws.filter((draw) => draw.id.startsWith(signature[realm])).reduce((sum, draw) => sum + (draw.kind === 'line' && draw.segments ? draw.segments.length : 1), 0);
            const cold = life(room({ comboDepth: 0 }));
            const deep = life(room({ comboDepth: 6 }));
            expect(cold, realm).toBeGreaterThan(0);
            expect(deep, realm).toBeGreaterThan(cold);
            // Half the drops; the rain's strokes carry only those in the air at that instant, so within a few.
            expect(Math.abs(life(room({ comboDepth: 0, tier: 'lean' })) - Math.ceil(cold / 2)), realm).toBeLessThanOrEqual(realm === 'storm' ? Math.ceil(cold * 0.1) : 0);
            expect(life(room({ comboDepth: 6, tier: 'still' })), realm).toBe(0);
        }
    });

    it("lifts a realm room's glow with every link, and past full drives an overdrive of it without end", () => {
        const run = makeRun([...makePair('a', 'A'), ...makePair('b', 'B')], { realmId: 'storm' });
        const at = (depth: number) => frame({ mood: mood('ember', { run }), comboDepth: depth, tier: 'still' });
        let lastGlow = 0;
        let lastBright = 0;
        for (const depth of [0, 0.5, 1, 2, 3, 5, 8, 12]) {
            const draws = at(depth);
            const glow = alphaOf(draws, 'realmGlow-ring');
            expect(glow).toBeGreaterThan(lastGlow);
            lastGlow = glow;
            const over = findSceneDraw(draws, 'realmGlowOver-ring') as SceneImageDraw | undefined;
            if (depth > 2) {
                expect(over!.filter!.brightness!).toBeGreaterThan(lastBright);
                lastBright = over!.filter!.brightness!;
            }
        }
        expect(lastGlow).toBeLessThanOrEqual(1);
    });

    it('stops the room for a beat when a frost stage is reached, and lets it go', () => {
        const frozenMood = { ...mood('frost'), freezeKey: 'freeze:1' };
        const clock = createSceneClock();
        let now = 0;
        const after = (ms: number, key: string | null): number[] => {
            let frames: number[] = [];
            for (const end = now + ms; now < end; ) {
                now += Math.min(50, end - now);
                frames = flamesOf(composeGameplayScene({ ...rest, mood: { ...frozenMood, freezeKey: key } }, clock.frame(now))).map((flame) => flame.frame!.index);
            }
            return frames;
        };
        after(200, null);
        const before = after(50, 'freeze:1');
        // Most of a second into the freeze nothing has moved on.
        expect(after(300, 'freeze:1')).toEqual(before);
        expect(after(400, 'freeze:1')).toEqual(before);
        // And then it has.
        expect(after(1500, 'freeze:1')).not.toEqual(before);
    });
});
