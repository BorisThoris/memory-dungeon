import { comboSoftCap } from '../../shared/combo-heat-rules';
import type { RealmId } from '../../shared/contracts';
import { sceneHash, sceneOccurrence } from './sceneClock';
import { ambientSprite, dripDraws, driftDraws, fogDraw, glintDraws, crossingDraws } from './sceneAmbient';
import type { SceneDraw } from './scenePaint';

/**
 * The things that move in a realm's own room (2026-10-09). The rooms came in as still paintings
 * with a glow; the owner's rule is that a painted room is never still - the cathedral has its
 * candles, wisps, dust and moths, the dungeon its torches, mist, bats and drips - and that all of it
 * climbs with the combo, without end. So each realm has its life, placed on its painting:
 *
 * - **frost**: snow falling through the vault, cold mist on the floor, glints running up the ice.
 * - **ember**: sparks rising off the lava seams, cinders drifting down, smoke and heat off the braziers.
 * - **tide**: bubbles rising, the shaft of light breathing, drops off the dome ringing the water.
 * - **storm**: rain driven across the platform, the sky lighting up, sparks at the rods' tips.
 * - **grove**: spores and fireflies under the roots, leaves coming down, the moonlight through the roof.
 *
 * The combo drives it on `comboDepth`: how much there is rises toward a budget on `comboSoftCap`
 * (still rising with every link), and how fast it moves and how often the sky breaks rise with the
 * depth itself, with no ceiling. Nothing here is drawn under reduced motion (the caller's `still`).
 */
export interface RealmRoomLifeInput {
    realm: RealmId;
    /** The room's clock, ms (stopped by a freeze, quickened by the surge). */
    t: number;
    /** `comboDepth` of the run's combo. */
    depth: number;
    /** Phone tier: half the specks. */
    lean: boolean;
    /** How much the realm's room is showing (its plate's crossfade). */
    alpha: number;
}

/** How many specks a budgeted drift carries at a depth: up to 2.5 times its rest, never quite. */
export const realmLifeCount = (base: number, depth: number, lean: boolean): number => {
    const count = Math.round(base * (1 + comboSoftCap(depth, 1.5)));
    return lean ? Math.ceil(count / 2) : count;
};

/** How fast the room moves at a depth: no ceiling, but slow (twice as fast at about a thousand links). */
export const realmLifePace = (depth: number): number => 1 + 0.15 * depth;

const FROST_GLINTS: ReadonlyArray<readonly [number, number]> = [
    [0.04, 0.3], [0.09, 0.55], [0.14, 0.42], [0.37, 0.28], [0.4, 0.5], [0.6, 0.3], [0.63, 0.52], [0.86, 0.42], [0.92, 0.3], [0.95, 0.56], [0.5, 0.74]
];
const EMBER_BRAZIERS: ReadonlyArray<readonly [number, number]> = [
    [0.17, 0.62], [0.33, 0.53], [0.67, 0.53], [0.83, 0.62]
];
const TIDE_DRIPS: ReadonlyArray<readonly [number, number, number]> = [
    [0.18, 0.02, 0.86], [0.41, 0.05, 0.9], [0.63, 0.04, 0.88], [0.84, 0.02, 0.85]
];
const STORM_RODS: ReadonlyArray<readonly [number, number]> = [
    [0.035, 0.12], [0.27, 0.2], [0.405, 0.24], [0.595, 0.24], [0.73, 0.2], [0.965, 0.12]
];
const GROVE_FUNGI: ReadonlyArray<readonly [number, number]> = [
    [0.11, 0.39], [0.16, 0.71], [0.24, 0.72], [0.39, 0.6], [0.53, 0.14], [0.66, 0.66], [0.74, 0.42], [0.84, 0.65], [0.93, 0.66]
];

const frostLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => [
    // Snow through the whole vault, a little heavier and faster with the chain.
    ...driftDraws({ idPrefix: 'frost-snow', cell: 'dotWhite', count: realmLifeCount(22, depth, lean), x: 0, y: -0.05, w: 1, h: 0.95, fall: 0.03 * pace, slide: 0.004, size: 0.011, alpha: 0.75 * alpha, seed: 61 }, t),
    ...driftDraws({ idPrefix: 'frost-snow-near', cell: 'dotWhite', count: realmLifeCount(6, depth, lean), x: 0, y: -0.05, w: 1, h: 1, fall: 0.06 * pace, slide: 0.01, size: 0.022, alpha: 0.45 * alpha, seed: 67 }, t),
    fogDraw({ id: 'frost-mist', t, alpha: 0.32 * alpha, mask: { kind: 'band', top: 0.62, solidFrom: 0.8, solidTo: 0.96, bottom: 1 }, speed: 0.005 * pace, tileW: 0.9, seed: 7 }),
    ...glintDraws({ idPrefix: 'frost-glint', points: FROST_GLINTS, t, everyMs: 7000 / pace, lastsMs: 1100, size: 0.05, alpha: 0.8 * alpha, seed: 71, cell: 'glint' }),
    // The cold off the ring, rising.
    ...driftDraws({ idPrefix: 'frost-breath', cell: 'dotCyan', count: realmLifeCount(8, depth, lean), x: 0.3, y: 0.55, w: 0.4, h: 0.3, fall: -0.012 * pace, slide: 0.003, size: 0.012, alpha: 0.5 * alpha, seed: 73 }, t)
];

const emberLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => {
    const draws: SceneDraw[] = [
        // Sparks off the lava seams on each wall, and over the floor.
        ...driftDraws({ idPrefix: 'ember-spark-l', cell: 'dotEmber', count: realmLifeCount(10, depth, lean), x: 0.02, y: 0.05, w: 0.22, h: 0.65, fall: -0.05 * pace, slide: 0.006, size: 0.012, alpha: 0.9 * alpha, seed: 81 }, t),
        ...driftDraws({ idPrefix: 'ember-spark-r', cell: 'dotEmber', count: realmLifeCount(10, depth, lean), x: 0.76, y: 0.05, w: 0.22, h: 0.65, fall: -0.05 * pace, slide: -0.006, size: 0.012, alpha: 0.9 * alpha, seed: 83 }, t),
        ...driftDraws({ idPrefix: 'ember-spark-floor', cell: 'dotEmber', count: realmLifeCount(8, depth, lean), x: 0.25, y: 0.45, w: 0.5, h: 0.4, fall: -0.035 * pace, slide: 0.004, size: 0.01, alpha: 0.7 * alpha, seed: 85 }, t),
        // Cinders coming down, dark against the glow.
        ...driftDraws({ idPrefix: 'ember-cinder', cell: 'dotCinder', count: realmLifeCount(8, depth, lean), x: 0, y: 0, w: 1, h: 0.85, fall: 0.012 * pace, slide: 0.003, size: 0.012, alpha: 0.6 * alpha, seed: 87, blend: 'source-over' }, t),
        fogDraw({ id: 'ember-haze', t, alpha: 0.18 * alpha, mask: { kind: 'band', top: 0.55, solidFrom: 0.75, solidTo: 0.95, bottom: 1 }, speed: 0.006 * pace, tileW: 0.8, seed: 9 })
    ];
    EMBER_BRAZIERS.forEach(([x, y], index) => {
        const flicker = 0.75 + 0.25 * Math.sin(t / (170 + index * 23) + index) * Math.sin(t / (410 + index * 31));
        draws.push(ambientSprite({ id: `ember-heat-${index}`, cell: 'haloWarm', x, y, size: 0.16, alpha: 0.35 * flicker * alpha, depth: 0.6 }));
        for (let puff = 0; puff < 2; puff += 1) {
            const period = 4800 / pace;
            const p = (((t + (puff * period) / 2 + index * 700) % period) + period) % period / period;
            draws.push(ambientSprite({ id: `ember-smoke-${index}-${puff}`, cell: 'smoke', x: x + 0.01 * Math.sin(p * 4 + index), y: y - 0.04 - 0.12 * p, size: 0.04 + 0.07 * p, alpha: 0.18 * Math.sin(p * Math.PI) * alpha, blend: 'source-over' }));
        }
    });
    return draws;
};

const tideLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => [
    // The shaft from the broken dome, breathing.
    { ...ambientSprite({ id: 'tide-shaft', cell: 'shafts', x: 0, y: 0, size: 1, alpha: 0 }), rect: { x: 0.36, y: -0.02, w: 0.28, h: 0.68 }, alpha: (0.22 + 0.12 * Math.sin(t / 3100)) * alpha, depth: 0.4 },
    ...driftDraws({ idPrefix: 'tide-mote', cell: 'dotTeal', count: realmLifeCount(10, depth, lean), x: 0.4, y: 0.05, w: 0.2, h: 0.55, fall: 0.006 * pace, slide: 0.002, size: 0.01, alpha: 0.6 * alpha, seed: 91 }, t),
    // Bubbles rising off the floor of the vault, through the water and on up.
    ...driftDraws({ idPrefix: 'tide-bubble', cell: 'bubble', count: realmLifeCount(14, depth, lean), x: 0.04, y: 0.3, w: 0.92, h: 0.68, fall: -0.03 * pace, slide: 0.002, size: 0.016, alpha: 0.55 * alpha, seed: 93 }, t),
    ...dripDraws({ idPrefix: 'tide-drip', t, everyMs: 9000 / pace, seed: 97, spots: TIDE_DRIPS, alpha: 0.7 * alpha }),
    fogDraw({ id: 'tide-mist', t, alpha: 0.2 * alpha, mask: { kind: 'band', top: 0.62, solidFrom: 0.78, solidTo: 0.95, bottom: 1 }, speed: 0.004 * pace, tileW: 1, seed: 11 })
];

const stormLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => {
    const draws: SceneDraw[] = [
        // Rain driven across the platform, faster and thicker with the chain.
        ...driftDraws({ idPrefix: 'storm-rain', cell: 'streak', count: realmLifeCount(26, depth, lean), x: 0, y: -0.1, w: 1, h: 1.1, fall: 0.7 * pace, slide: -0.06 * pace, size: 0.05, alpha: 0.35 * alpha, seed: 101 }, t),
        ...glintDraws({ idPrefix: 'storm-rod', points: STORM_RODS, t, everyMs: 5200 / pace, lastsMs: 500, size: 0.06, alpha: 0.9 * alpha, seed: 103, cell: 'dotViolet' }),
        fogDraw({ id: 'storm-cloud', t, alpha: 0.22 * alpha, mask: { kind: 'band', top: 0, solidFrom: 0.05, solidTo: 0.3, bottom: 0.48 }, speed: 0.012 * pace, tileW: 0.9, seed: 13 })
    ];
    // The sky breaks: a flash behind the clouds, more often the deeper the chain - without end.
    const flash = sceneOccurrence(t, 6500 / pace, 600, 107);
    if (flash) {
        const p = flash.progress;
        const level = p < 0.1 ? p / 0.1 : p < 0.25 ? 1 - (p - 0.1) * 3 : p < 0.35 ? 0.55 + (p - 0.25) * 4 : Math.max(0, 0.95 - (p - 0.35) * 1.5);
        const cx = 0.25 + 0.5 * sceneHash(flash.index, 108);
        draws.push({
            kind: 'glow',
            id: 'storm-sky',
            alpha: level * alpha,
            blend: 'screen',
            cx,
            cy: 0.12,
            rx: 0.55,
            ry: 0.4,
            stops: [
                [0, 'rgba(214, 190, 255, 0.6)'],
                [0.7, 'rgba(214, 190, 255, 0)'],
                [1, 'rgba(214, 190, 255, 0)']
            ]
        });
    }
    return draws;
};

const groveLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => [
    { ...ambientSprite({ id: 'grove-moonlight', cell: 'shafts', x: 0, y: 0, size: 1, alpha: 0 }), rect: { x: 0.38, y: -0.02, w: 0.26, h: 0.62 }, alpha: (0.16 + 0.08 * Math.sin(t / 4300)) * alpha, depth: 0.4 },
    ...driftDraws({ idPrefix: 'grove-spore', cell: 'dotSpore', count: realmLifeCount(16, depth, lean), x: 0.03, y: 0.1, w: 0.94, h: 0.75, fall: -0.008 * pace, slide: 0.004, size: 0.011, alpha: 0.7 * alpha, seed: 111 }, t),
    ...driftDraws({ idPrefix: 'grove-firefly', cell: 'dotFirefly', count: realmLifeCount(8, depth, lean), x: 0.08, y: 0.45, w: 0.84, h: 0.45, fall: -0.004 * pace, slide: 0.008 * pace, size: 0.016, alpha: 0.85 * alpha, seed: 113 }, t),
    ...driftDraws({ idPrefix: 'grove-leaf', cell: 'leaf', count: realmLifeCount(4, depth, lean), x: 0.1, y: -0.05, w: 0.8, h: 1, fall: 0.025 * pace, slide: 0.012, size: 0.024, alpha: 0.75 * alpha, seed: 117, blend: 'source-over' }, t),
    ...glintDraws({ idPrefix: 'grove-fungus', points: GROVE_FUNGI, t, everyMs: 6000 / pace, lastsMs: 1600, size: 0.045, alpha: 0.7 * alpha, seed: 119, cell: 'dotSpore' }),
    ...crossingDraws({ id: 'grove-moth', cell: 'moth', t, everyMs: 21_000 / pace, lastsMs: 5200, seed: 121, fromX: 0.2, toX: 0.8, yMin: 0.3, yMax: 0.55, size: 0.028, alpha: 0.75 * alpha, bob: 0.02 }),
    fogDraw({ id: 'grove-mist', t, alpha: 0.26 * alpha, mask: { kind: 'band', top: 0.66, solidFrom: 0.82, solidTo: 0.96, bottom: 1 }, speed: 0.003 * pace, tileW: 1, seed: 15 })
];

const LIFE: Readonly<Record<RealmId, (input: RealmRoomLifeInput, pace: number) => SceneDraw[]>> = {
    frost: frostLife,
    ember: emberLife,
    tide: tideLife,
    storm: stormLife,
    grove: groveLife
};

/** The realm's room's life at this moment: nothing while its room is not showing. */
export const realmRoomLifeDraws = (input: RealmRoomLifeInput): SceneDraw[] =>
    input.alpha <= 0.004 ? [] : LIFE[input.realm](input, realmLifePace(input.depth));
