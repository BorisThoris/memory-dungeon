import { comboSoftCap } from '../../shared/combo-heat-rules';
import type { RealmId } from '../../shared/contracts';
import type { AmbientCellName, SceneSpriteDef } from '../assets/ui/sprites';
import { sceneHash, sceneOccurrence, sceneSmoothstep } from './sceneClock';
import { ambientSprite, crossingDraws, dripDraws, driftDraws, fogDraw, glintDraws, sceneKeyframes } from './sceneAmbient';
import type { SceneBlend, SceneDraw } from './scenePaint';
import type { GoldFloorBand } from './goldRain';

/**
 * Each room's floor, as it is painted: where gold, rain, snow and leaves come down (its far edge
 * and near edge on the plate), whether it is water, and its camera - the horizon (where the floor's
 * lines meet) and the focal length that its rune ring gives (pixel height over pixel width of the
 * ring at its height; see `GoldFloorBand`). Measured on the paintings on a 10% grid.
 *   frost: ring at 0.78, 0.12 tall for wide, horizon 0.45;  ember: 0.60, 0.084, 0.43;
 *   tide: the dais at 0.63, 0.093, 0.47;  storm: 0.66, 0.12, 0.45;  grove: 0.79, 0.093, 0.58.
 */
export const REALM_FLOORS: Readonly<Record<RealmId, { band: GoldFloorBand; water: boolean }>> = {
    frost: { band: { far: 0.66, near: 0.97, horizon: 0.45, focal: 2.75 }, water: false },
    ember: { band: { far: 0.6, near: 0.97, horizon: 0.43, focal: 2.0 }, water: false },
    tide: { band: { far: 0.7, near: 0.97, horizon: 0.47, focal: 1.7 }, water: true },
    storm: { band: { far: 0.58, near: 0.97, horizon: 0.45, focal: 1.75 }, water: false },
    grove: { band: { far: 0.74, near: 0.97, horizon: 0.58, focal: 2.26 }, water: false }
};

/**
 * The things that live in a realm's own room (2026-10-09). The rooms came in as still paintings
 * with a glow; the owner's rule is that a painted room is never still, and that what falls in it
 * lands: "the storm needs to live, lightning needs to strike in the background ... if we have rain it
 * needs to physically fall on the ground". So each realm has its life, placed on its painting:
 *
 * - **frost**: snow falling through the vault and settling on the floor, gusts that drive it
 *   sideways, the cold off the ring, glints running up the ice, drips off the arches, low mist.
 * - **ember**: sparks off the lava seams, the seams pulsing, eruptions that throw embers in arcs to
 *   the floor, cinders coming down and cooling on the stone, heat and smoke off the braziers.
 * - **tide**: drops off the dome ringing the water, bubbles rising and breaking at the surface, the
 *   shaft of light breathing with motes in it, light on the water, mist.
 * - **storm**: rain driven across the platform that strikes the stone and splashes, lightning that
 *   comes down out of the clouds onto the rods and the horizon, branching, the sky and the ground
 *   lit by it, the rods glowing after, sheet lightning inside the clouds, puddles catching it.
 * - **grove**: leaves coming down through the roots and lying on the floor, spores and fireflies,
 *   fungus that pulses, a moth, the moonlight through the roof, mist.
 *
 * The combo drives it on `comboDepth`: how much there is rises toward a budget on `comboSoftCap`
 * (still rising with every link), and how fast it moves and how often the sky breaks rise with the
 * depth itself, with no ceiling; the storm also strikes on more channels at once. Nothing here is
 * drawn under reduced motion (the caller's `still`).
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

/** How many places the storm strikes from at once: one at rest, a fourth channel never quite reached. */
export const stormStrikeChannels = (depth: number): number => 1 + Math.floor(Math.min(comboSoftCap(depth, 3), 2.999));

// ------------------------------------------------------------------ things that come down and land

interface LandingSpec {
    idPrefix: string;
    cell: AmbientCellName;
    count: number;
    t: number;
    floor: GoldFloorBand;
    /** Where across the plate they come down. */
    xMin: number;
    xMax: number;
    /** Where they start, fraction of the plate's height (above the top is fine). */
    fromY: number;
    /** Seconds a near one takes to come down; a far one has less far to fall. */
    fallS: number;
    /** Falling under gravity (a leaf, a cinder) or at its terminal speed (rain, snow). */
    gravity: boolean;
    /** Seconds it lies where it landed, going out. */
    lieS: number;
    /** Seconds before it comes again. */
    gapS: number;
    /** Plate widths a second it is carried sideways, and how far it sways. */
    slide: number;
    sway: number;
    size: number;
    alpha: number;
    seed: number;
    blend?: SceneBlend;
    /** Turns as it falls (a leaf). */
    tumble?: number;
    /** Lying, how flat it is drawn (1: as it fell). */
    lieScaleY?: number;
    /** Drawn along its fall (a rain streak leans with the wind). */
    rotate?: number;
    /** What its landing leaves: a ring on wet stone, or nothing. */
    splash?: { cell: AmbientCellName; seconds: number; size: number; alpha: number; drops?: boolean };
}

/**
 * Things that come down and land on the room's floor: rain, snow, leaves, cinders. Each one falls
 * to its own spot on the floor (the far floor is higher on the plate, so far ones are smaller and
 * have less far to fall), lands there, leaves its splash, lies and goes out, and comes again
 * somewhere else. One draw per thing always (transparent while it waits), so counts are counts.
 */
export const landingDraws = (spec: LandingSpec): SceneDraw[] => {
    const s = spec.t / 1000;
    const out: SceneDraw[] = [];
    for (let index = 0; index < spec.count; index += 1) {
        const cycle = spec.fallS + spec.lieS + spec.gapS;
        const local0 = s + sceneHash(index, spec.seed) * cycle;
        const round = Math.floor(local0 / cycle);
        const local = local0 - round * cycle;
        const depth = sceneHash(index * 31 + round, spec.seed + 1);
        const x0 = spec.xMin + (spec.xMax - spec.xMin) * sceneHash(index * 17 + round, spec.seed + 2);
        const land = spec.floor.near + (spec.floor.far - spec.floor.near) * depth;
        const scale = 1 - 0.45 * depth;
        const fall = spec.fallS * (0.7 + 0.3 * ((land - spec.fromY) / Math.max(0.01, spec.floor.near - spec.fromY)));
        const id = `${spec.idPrefix}-${index}`;
        if (local < fall) {
            const p = local / fall;
            const along = spec.gravity ? p * p : p;
            const sway = spec.sway * Math.sin(local * 2.1 + index) * (1 - 0.5 * depth);
            out.push(
                ambientSprite({
                    id,
                    cell: spec.cell,
                    x: x0 + spec.slide * local + sway,
                    y: spec.fromY + (land - spec.fromY) * along - (spec.size * scale) / 2,
                    size: spec.size * scale,
                    alpha: spec.alpha * sceneSmoothstep(0, 0.08, p) * (0.75 + 0.25 * (1 - depth)),
                    blend: spec.blend,
                    rotate: spec.tumble ? spec.tumble * local + index : spec.rotate,
                    frame: 0
                })
            );
            continue;
        }
        const since = local - fall;
        const xLand = x0 + spec.slide * fall + spec.sway * Math.sin(fall * 2.1 + index) * (1 - 0.5 * depth);
        const lying = spec.lieS > 0 && since < spec.lieS ? 1 - since / spec.lieS : 0;
        out.push(
            ambientSprite({
                id,
                cell: spec.cell,
                x: xLand,
                y: land - (spec.size * scale * (spec.lieScaleY ?? 1)) / 2,
                size: spec.size * scale,
                alpha: spec.alpha * lying * (0.75 + 0.25 * (1 - depth)),
                blend: spec.blend,
                scaleY: spec.lieScaleY,
                rotate: spec.tumble ? spec.tumble * fall + index : spec.rotate
            })
        );
        const splash = spec.splash;
        if (splash && since < splash.seconds) {
            const q = since / splash.seconds;
            out.push(
                ambientSprite({
                    id: `splash-${spec.idPrefix}-${index}`,
                    cell: splash.cell,
                    x: xLand,
                    y: land,
                    size: (splash.size * 0.3 + splash.size * q) * scale,
                    alpha: splash.alpha * (1 - q) ** 1.5,
                    // A ring on the floor is seen edge-on: wide and flat.
                    scaleX: 2.6
                })
            );
            if (splash.drops && q < 0.6) {
                const jump = q / 0.6;
                for (const side of [-1, 1] as const) {
                    out.push(
                        ambientSprite({
                            id: `spray-${spec.idPrefix}-${index}-${side < 0 ? 'l' : 'r'}`,
                            cell: 'drop',
                            x: xLand + side * 0.008 * jump * scale,
                            y: land - 0.018 * scale * 4 * jump * (1 - jump),
                            size: 0.01 * scale,
                            alpha: splash.alpha * 0.8 * (1 - jump)
                        })
                    );
                }
            }
        }
    }
    return out;
};

// ------------------------------------------------------------------ rain

/** The plate is this much wider than tall: a slant in plate heights is this much less in plate widths. */
const PLATE_ASPECT = 1376 / 768;
/** The wind: plate heights sideways per plate height of fall. Rain leans a little, it does not fly. */
export const RAIN_WIND = 0.08;

interface RainSpec {
    idPrefix: string;
    count: number;
    t: number;
    floor: GoldFloorBand;
    alpha: number;
    seed: number;
    /** Multiplies the fall speed (the combo's pace). */
    pace: number;
    /** The crown of droplets each splash throws (off on a phone). */
    crowns: boolean;
}

/**
 * Rain that falls the way rain does (2026-10-09; the first cut drew each drop as a sideways bar).
 * Each drop is a streak along its own velocity: nearly straight down at terminal speed, leaning with
 * one wind for all of them, long and bright near the camera and short, faint and slow on the plate
 * far off. It strikes the floor where the painting's floor is at its depth, and the strike throws a
 * crown of droplets on short ballistic arcs and leaves a ring spreading on the wet stone.
 */
export const rainDraws = (spec: RainSpec): SceneDraw[] => {
    const s = spec.t / 1000;
    const out: SceneDraw[] = [];
    const fromY = -0.12;
    const splashS = 0.34;
    for (let index = 0; index < spec.count; index += 1) {
        const depth = sceneHash(index, spec.seed);
        // A far drop covers less of the plate in the same time: it looks slower and shorter.
        const fallS = (0.42 + 0.38 * depth) / spec.pace;
        const cycle = fallS + splashS + 0.1 + 0.2 * sceneHash(index, spec.seed + 3);
        const local0 = s + sceneHash(index, spec.seed + 1) * cycle;
        const round = Math.floor(local0 / cycle);
        const local = local0 - round * cycle;
        const land = spec.floor.near + (spec.floor.far - spec.floor.near) * depth;
        const drop = land - fromY;
        const vy = drop / fallS;
        const vx = (RAIN_WIND * vy) / PLATE_ASPECT;
        // Where this round's drop comes down: anywhere across, so long as it lands on the plate.
        const xLand = 0.02 + 0.96 * sceneHash(index * 31 + round, spec.seed + 2);
        const near = 1 - depth;
        const length = 0.045 + 0.1 * near;
        const width = 0.0012 + 0.0028 * near;
        const alpha = spec.alpha * (0.55 + 0.45 * near);
        if (local < fallS) {
            const y = fromY + vy * local;
            const x = xLand - vx * (fallS - local);
            const tailDt = length / vy;
            out.push({ kind: 'line', id: `${spec.idPrefix}-${index}`, alpha, blend: 'lighter', color: 'rgb(150, 165, 190)', width, points: [[x - vx * tailDt, y - length], [x, y]] });
            continue;
        }
        // The drop is spent: one draw still, transparent, so a count is a count.
        out.push({ kind: 'line', id: `${spec.idPrefix}-${index}`, alpha: 0, blend: 'screen', color: 'rgb(214, 226, 242)', width, points: [[xLand, land], [xLand, land]] });
        const since = local - fallS;
        if (since >= splashS) continue;
        const q = since / splashS;
        out.push(
            ambientSprite({
                id: `splash-${spec.idPrefix}-${index}`,
                cell: 'ripple',
                x: xLand,
                y: land,
                size: (0.01 + 0.038 * q) * (0.45 + 0.55 * near),
                alpha: Math.min(1, spec.alpha * 1.6) * (1 - q) ** 1.4,
                scaleX: 2.8
            })
        );
        if (!spec.crowns) continue;
        // The crown: droplets thrown up and out, falling back under gravity, each a short streak along its path.
        const g = 3.2;
        for (let bead = 0; bead < 3; bead += 1) {
            const spread = (bead - 1) * 0.9 + (sceneHash(index * 7 + bead + round, spec.seed + 5) - 0.5) * 0.5;
            const up = (0.18 + 0.12 * sceneHash(index * 11 + bead + round, spec.seed + 6)) * (0.4 + 0.6 * near);
            const out_ = 0.05 * spread * (0.4 + 0.6 * near);
            const bx = xLand + (out_ * since) / PLATE_ASPECT;
            const by = land - (up * since - 0.5 * g * since * since);
            if (by > land) continue;
            const dvy = -up + g * since;
            const dt = 0.018;
            out.push({
                kind: 'line',
                id: `crown-${spec.idPrefix}-${index}-${bead}`,
                alpha: spec.alpha * 1.2 * (1 - q),
                blend: 'screen',
                color: 'rgb(226, 236, 250)',
                width: width * 0.8,
                points: [[bx - (out_ * dt) / PLATE_ASPECT, by - dvy * dt], [bx, by]]
            });
        }
    }
    return out;
};

// ------------------------------------------------------------------ lightning

/**
 * A bolt from `from` to `to`, jagged: each segment's midpoint pushed aside by a seeded amount that
 * halves with every split, the way the classic bolt is drawn. Pure, so a strike is the same bolt
 * from its first frame to its last.
 */
export const lightningPath = (seed: number, from: readonly [number, number], to: readonly [number, number], splits = 5, roughness = 0.09): Array<[number, number]> => {
    let points: Array<[number, number]> = [[from[0], from[1]], [to[0], to[1]]];
    let reach = roughness;
    for (let split = 0; split < splits; split += 1) {
        const next: Array<[number, number]> = [points[0]!];
        for (let index = 1; index < points.length; index += 1) {
            const [ax, ay] = points[index - 1]!;
            const [bx, by] = points[index]!;
            const dx = bx - ax;
            const dy = by - ay;
            const length = Math.hypot(dx, dy) || 1;
            const push = (sceneHash(seed * 7 + split * 131 + index, 41) - 0.5) * 2 * reach;
            // Pushed across the segment, so the bolt zigzags rather than stretches.
            next.push([(ax + bx) / 2 - (dy / length) * push, (ay + by) / 2 + (dx / length) * push * 0.35]);
            next.push([bx, by]);
        }
        points = next;
        reach *= 0.52;
    }
    return points;
};

const STORM_RODS: ReadonlyArray<readonly [number, number]> = [
    [0.035, 0.12], [0.27, 0.2], [0.405, 0.24], [0.595, 0.24], [0.73, 0.2], [0.965, 0.12]
];

/** The flicker of one strike: a stroke, a dip, a restrike, and the long fade. */
const strikeLevel = (p: number): number =>
    sceneKeyframes(p, [[0, 0], [0.03, 1], [0.12, 0.2], [0.18, 0.95], [0.3, 0.45], [0.42, 0.75], [1, 0]]);

const boltDraws = (id: string, points: ReadonlyArray<readonly [number, number]>, level: number, alpha: number, width: number): SceneDraw[] => [
    { kind: 'line', id: `${id}-halo`, alpha: level * 0.16 * alpha, blend: 'screen', points, color: '#b48cff', width: width * 10 },
    { kind: 'line', id: `${id}-glow`, alpha: level * 0.38 * alpha, blend: 'screen', points, color: '#b48cff', width: width * 5 },
    { kind: 'line', id: `${id}-edge`, alpha: level * 0.6 * alpha, blend: 'screen', points, color: '#cdb4ff', width: width * 2.3 },
    { kind: 'line', id, alpha: level * alpha, blend: 'screen', points, color: '#f6f1ff', width }
];

/** How bright the storm's lightning is at this moment, 0..1: the brightest strike on any channel. */
export const stormStrikeLevel = (t: number, depth: number): number => {
    const pace = realmLifePace(depth);
    let level = 0;
    for (let channel = 0; channel < stormStrikeChannels(depth); channel += 1) {
        const strike = sceneOccurrence(t + channel * 1733, (5600 + channel * 900) / pace, 700, 301 + channel * 17);
        if (strike) level = Math.max(level, strikeLevel(strike.progress));
    }
    return level;
};

/** The storm's sheet lightning inside the clouds at this moment, 0..1. */
export const stormSheetLevel = (t: number, depth: number): number => {
    const sheet = sceneOccurrence(t, 2300 / realmLifePace(depth), 380, 331);
    return sheet ? Math.sin(sheet.progress * Math.PI) : 0;
};

/** The storm's strikes at this moment: each channel on its own clock, more channels the deeper the chain. */
export const stormStrikeDraws = (t: number, depth: number, alpha: number): SceneDraw[] => {
    const pace = realmLifePace(depth);
    const draws: SceneDraw[] = [];
    const channels = stormStrikeChannels(depth);
    for (let channel = 0; channel < channels; channel += 1) {
        const strike = sceneOccurrence(t + channel * 1733, (5600 + channel * 900) / pace, 700, 301 + channel * 17);
        if (!strike) continue;
        const level = strikeLevel(strike.progress);
        if (level <= 0.01) continue;
        const seed = strike.index * 13 + channel * 101;
        // Onto a rod, or down to the horizon between them.
        const onRod = sceneHash(seed, 302) < 0.6;
        const rod = STORM_RODS[Math.floor(sceneHash(seed, 303) * STORM_RODS.length)]!;
        const to: readonly [number, number] = onRod ? rod : [0.15 + 0.7 * sceneHash(seed, 304), 0.4 + 0.04 * sceneHash(seed, 305)];
        const from: readonly [number, number] = [to[0] + (sceneHash(seed, 306) - 0.5) * 0.3, -0.02];
        const main = lightningPath(seed, from, to, 6, 0.1);
        const tag = `storm-bolt-${channel}`;
        draws.push(...boltDraws(tag, main, level, alpha, 0.0032));
        // Two branches off the stroke, thinner, dying out before they reach anything.
        for (let branch = 0; branch < 2; branch += 1) {
            const at = main[Math.floor(main.length * (0.3 + 0.3 * sceneHash(seed, 310 + branch)))]!;
            const end: readonly [number, number] = [at[0] + (sceneHash(seed, 312 + branch) - 0.5) * 0.18, at[1] + 0.06 + 0.1 * sceneHash(seed, 314 + branch)];
            draws.push(...boltDraws(`${tag}-branch-${branch}`, lightningPath(seed + 50 + branch, at, end, 4, 0.05), level * 0.7, alpha, 0.0016));
        }
        // The sky behind it lit, and the ground where it came down.
        draws.push({
            kind: 'glow',
            id: `${tag}-sky`,
            alpha: level * 0.75 * alpha,
            blend: 'screen',
            cx: from[0],
            cy: 0.1,
            rx: 0.5,
            ry: 0.35,
            stops: [
                [0, 'rgba(214, 190, 255, 0.55)'],
                [0.7, 'rgba(214, 190, 255, 0)'],
                [1, 'rgba(214, 190, 255, 0)']
            ]
        });
        draws.push({
            kind: 'glow',
            id: `${tag}-ground`,
            alpha: level * 0.6 * alpha,
            blend: 'screen',
            cx: to[0],
            cy: Math.max(to[1], 0.5),
            rx: 0.3,
            ry: 0.18,
            stops: [
                [0, 'rgba(225, 205, 255, 0.5)'],
                [1, 'rgba(225, 205, 255, 0)']
            ]
        });
        if (onRod) {
            // The rod it struck holds the charge and lets it go.
            const after = Math.max(0, 1 - strike.progress * 1.3);
            draws.push(ambientSprite({ id: `${tag}-rod`, cell: 'haloCool', x: rod[0], y: rod[1], size: 0.12, alpha: (0.4 + 0.6 * level) * after * alpha }));
        }
    }
    // Sheet lightning inside the clouds: no bolt, a cloud lit from within, often.
    const sheet = sceneOccurrence(t, 2300 / pace, 380, 331);
    if (sheet) {
        draws.push({
            kind: 'glow',
            id: 'storm-sheet',
            alpha: Math.sin(sheet.progress * Math.PI) * 0.45 * alpha,
            blend: 'screen',
            cx: 0.1 + 0.8 * sceneHash(sheet.index, 332),
            cy: 0.08 + 0.12 * sceneHash(sheet.index, 333),
            rx: 0.22,
            ry: 0.12,
            stops: [
                [0, 'rgba(190, 160, 255, 0.5)'],
                [1, 'rgba(190, 160, 255, 0)']
            ]
        });
    }
    return draws;
};

// ------------------------------------------------------------------ the rooms

const FROST_GLINTS: ReadonlyArray<readonly [number, number]> = [
    [0.04, 0.3], [0.09, 0.55], [0.14, 0.42], [0.37, 0.28], [0.4, 0.5], [0.6, 0.3], [0.63, 0.52], [0.86, 0.42], [0.92, 0.3], [0.95, 0.56], [0.5, 0.74]
];
const FROST_ICICLES: ReadonlyArray<readonly [number, number, number]> = [
    [0.21, 0.08, 0.7], [0.33, 0.12, 0.68], [0.67, 0.12, 0.68], [0.79, 0.08, 0.7]
];
const EMBER_BRAZIERS: ReadonlyArray<readonly [number, number]> = [
    [0.17, 0.62], [0.33, 0.53], [0.67, 0.53], [0.83, 0.62]
];
/** Points along the lava seams on the walls, where the rock glows and erupts. */
const EMBER_SEAMS: ReadonlyArray<readonly [number, number]> = [
    [0.06, 0.25], [0.1, 0.45], [0.13, 0.15], [0.86, 0.2], [0.9, 0.4], [0.94, 0.1], [0.5, 0.6]
];
const TIDE_DRIPS: ReadonlyArray<readonly [number, number, number]> = [
    [0.18, 0.02, 0.86], [0.41, 0.05, 0.9], [0.63, 0.04, 0.88], [0.84, 0.02, 0.85], [0.3, 0.03, 0.8], [0.72, 0.03, 0.82]
];
const TIDE_WATER_GLINTS: ReadonlyArray<readonly [number, number]> = [
    [0.12, 0.78], [0.25, 0.9], [0.4, 0.84], [0.58, 0.87], [0.71, 0.79], [0.86, 0.92], [0.5, 0.73]
];
const STORM_PUDDLES: ReadonlyArray<readonly [number, number]> = [
    [0.15, 0.72], [0.3, 0.86], [0.46, 0.66], [0.62, 0.78], [0.8, 0.7], [0.9, 0.9]
];
const GROVE_FUNGI: ReadonlyArray<readonly [number, number]> = [
    [0.11, 0.39], [0.16, 0.71], [0.24, 0.72], [0.39, 0.6], [0.53, 0.14], [0.66, 0.66], [0.74, 0.42], [0.84, 0.65], [0.93, 0.66]
];

const frostLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => {
    const floor = REALM_FLOORS.frost.band;
    // A gust now and then: the snow is driven sideways while it blows.
    const gust = sceneOccurrence(t, 11_000 / pace, 2600, 51);
    const blow = gust ? Math.sin(gust.progress * Math.PI) : 0;
    return [
        // Snow through the whole vault, settling on the floor, heavier and faster with the chain.
        ...landingDraws({ idPrefix: 'frost-snow', cell: 'dotWhite', count: realmLifeCount(26, depth, lean), t, floor, xMin: -0.05, xMax: 1.05, fromY: -0.04, fallS: 9 / pace, gravity: false, lieS: 3.5, gapS: 0.5, slide: 0.006 + 0.05 * blow, sway: 0.012, size: 0.012, alpha: 0.8 * alpha, seed: 61, lieScaleY: 0.7 }),
        ...driftDraws({ idPrefix: 'frost-flake-near', cell: 'dotWhite', count: realmLifeCount(6, depth, lean), x: 0, y: -0.05, w: 1, h: 1, fall: 0.06 * pace, slide: 0.01 + 0.12 * blow, size: 0.022, alpha: 0.45 * alpha, seed: 67 }, t),
        ...driftDraws({ idPrefix: 'frost-gust', cell: 'dotWhite', count: blow > 0.05 ? realmLifeCount(10, depth, lean) : 0, x: 0, y: 0.35, w: 1, h: 0.5, fall: 0.01, slide: 0.35 * pace, size: 0.008, alpha: 0.6 * blow * alpha, seed: 69 }, t),
        fogDraw({ id: 'frost-mist', t, alpha: (0.32 + 0.2 * blow) * alpha, mask: { kind: 'band', top: 0.62, solidFrom: 0.8, solidTo: 0.96, bottom: 1 }, speed: (0.005 + 0.03 * blow) * pace, tileW: 0.9, seed: 7 }),
        ...glintDraws({ idPrefix: 'frost-glint', points: FROST_GLINTS, t, everyMs: 7000 / pace, lastsMs: 1100, size: 0.05, alpha: 0.8 * alpha, seed: 71, cell: 'glint' }),
        ...dripDraws({ idPrefix: 'frost-drip', t, everyMs: 12_000 / pace, seed: 75, spots: FROST_ICICLES, alpha: 0.65 * alpha }),
        // The cold off the ring, rising.
        ...driftDraws({ idPrefix: 'frost-breath', cell: 'dotCyan', count: realmLifeCount(8, depth, lean), x: 0.3, y: 0.55, w: 0.4, h: 0.3, fall: -0.012 * pace, slide: 0.003, size: 0.012, alpha: 0.5 * alpha, seed: 73 }, t)
    ];
};

const emberLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => {
    const floor = REALM_FLOORS.ember.band;
    const draws: SceneDraw[] = [
        // Sparks off the lava seams on each wall, and over the floor.
        ...driftDraws({ idPrefix: 'ember-spark-l', cell: 'dotEmber', count: realmLifeCount(10, depth, lean), x: 0.02, y: 0.05, w: 0.22, h: 0.65, fall: -0.05 * pace, slide: 0.006, size: 0.012, alpha: 0.9 * alpha, seed: 81 }, t),
        ...driftDraws({ idPrefix: 'ember-spark-r', cell: 'dotEmber', count: realmLifeCount(10, depth, lean), x: 0.76, y: 0.05, w: 0.22, h: 0.65, fall: -0.05 * pace, slide: -0.006, size: 0.012, alpha: 0.9 * alpha, seed: 83 }, t),
        ...driftDraws({ idPrefix: 'ember-spark-floor', cell: 'dotEmber', count: realmLifeCount(8, depth, lean), x: 0.25, y: 0.45, w: 0.5, h: 0.4, fall: -0.035 * pace, slide: 0.004, size: 0.01, alpha: 0.7 * alpha, seed: 85 }, t),
        // Cinders coming down and cooling on the stone where they land.
        ...landingDraws({ idPrefix: 'ember-cinder', cell: 'dotCinder', count: realmLifeCount(10, depth, lean), t, floor, xMin: 0.05, xMax: 0.95, fromY: 0.0, fallS: 6 / pace, gravity: false, lieS: 2.5, gapS: 1, slide: 0.004, sway: 0.01, size: 0.013, alpha: 0.75 * alpha, seed: 87, blend: 'source-over', lieScaleY: 0.6 }),
        fogDraw({ id: 'ember-haze', t, alpha: 0.18 * alpha, mask: { kind: 'band', top: 0.55, solidFrom: 0.75, solidTo: 0.95, bottom: 1 }, speed: 0.006 * pace, tileW: 0.8, seed: 9 })
    ];
    // The seams breathe: each point of the lava swells and settles on its own slow beat.
    EMBER_SEAMS.forEach(([x, y], index) => {
        const swell = 0.5 + 0.5 * Math.sin((t * pace) / (1900 + index * 310) + index * 1.7);
        draws.push(ambientSprite({ id: `ember-seam-${index}`, cell: 'haloWarm', x, y, size: 0.14, alpha: (0.15 + 0.3 * swell) * alpha, depth: 0.5 }));
    });
    // An eruption: a seam throws a fountain of embers that arc out and come down on the floor.
    const burst = sceneOccurrence(t, 7000 / pace, 1800, 89);
    if (burst) {
        const [sx, sy] = EMBER_SEAMS[Math.floor(sceneHash(burst.index, 90) * EMBER_SEAMS.length)]!;
        const sparks = realmLifeCount(10, depth, lean);
        const seconds = (burst.progress * 1800) / 1000;
        const ground = floor.near - 0.12;
        for (let index = 0; index < sparks; index += 1) {
            const vx = (sceneHash(burst.index * 40 + index, 91) - 0.5) * 0.35;
            const vy = 0.35 + 0.35 * sceneHash(burst.index * 40 + index, 92);
            const x = sx + vx * seconds;
            const y = Math.min(ground, sy - vy * seconds + 0.6 * seconds * seconds);
            const down = y >= ground;
            draws.push(ambientSprite({ id: `ember-burst-${index}`, cell: down ? 'dotCinder' : 'dotEmber', x, y, size: down ? 0.01 : 0.014, alpha: (down ? 0.6 : 1) * (1 - burst.progress) * alpha, blend: down ? 'source-over' : 'lighter' }));
        }
        draws.push(ambientSprite({ id: 'ember-burst-flash', cell: 'haloWarm', x: sx, y: sy, size: 0.22, alpha: Math.max(0, 1 - burst.progress * 3) * 0.8 * alpha }));
    }
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

const tideLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => {
    const surface = 0.66;
    const draws: SceneDraw[] = [
        // Motes turning in the shaft (the shaft itself is the painting's, falling: realm_layers.py).
        ...driftDraws({ idPrefix: 'tide-mote', cell: 'dotTeal', count: realmLifeCount(10, depth, lean), x: 0.4, y: 0.05, w: 0.2, h: 0.55, fall: 0.006 * pace, slide: 0.002, size: 0.01, alpha: 0.6 * alpha, seed: 91 }, t),
        // Bubbles rising off the floor of the vault through the water.
        ...driftDraws({ idPrefix: 'tide-bubble', cell: 'bubble', count: realmLifeCount(14, depth, lean), x: 0.04, y: surface, w: 0.92, h: 0.32, fall: -0.03 * pace, slide: 0.002, size: 0.016, alpha: 0.55 * alpha, seed: 93 }, t),
        // Drops off the dome, ringing the water where they land.
        ...dripDraws({ idPrefix: 'tide-drip', t, everyMs: 7000 / pace, seed: 97, spots: TIDE_DRIPS, alpha: 0.75 * alpha }),
        ...glintDraws({ idPrefix: 'tide-water', points: TIDE_WATER_GLINTS, t, everyMs: 3500 / pace, lastsMs: 900, size: 0.04, alpha: 0.6 * alpha, seed: 98, cell: 'dotCyan' }),
        fogDraw({ id: 'tide-mist', t, alpha: 0.2 * alpha, mask: { kind: 'band', top: 0.62, solidFrom: 0.78, solidTo: 0.95, bottom: 1 }, speed: 0.004 * pace, tileW: 1, seed: 11 })
    ];
    // A bubble breaking the surface: a ring where it came up.
    for (let index = 0; index < realmLifeCount(4, depth, lean); index += 1) {
        const pop = sceneOccurrence(t + index * 1300, 3800 / pace, 900, 99 + index);
        if (!pop) continue;
        const x = 0.08 + 0.84 * sceneHash(pop.index * 5 + index, 100);
        const y = surface + 0.3 * sceneHash(pop.index * 5 + index, 101);
        draws.push(ambientSprite({ id: `tide-pop-${index}`, cell: 'ripple', x, y, size: 0.01 + 0.04 * pop.progress, alpha: 0.6 * (1 - pop.progress) ** 1.5 * alpha, scaleX: 2.6 }));
    }
    return draws;
};

const stormLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => [
    fogDraw({ id: 'storm-cloud', t, alpha: 0.26 * alpha, mask: { kind: 'band', top: 0, solidFrom: 0.05, solidTo: 0.3, bottom: 0.48 }, speed: 0.012 * pace, tileW: 0.9, seed: 13 }),
    // Lightning out of the clouds onto the rods and the horizon, behind everything else.
    ...stormStrikeDraws(t, depth, alpha),
    // Rain driven across the platform: it strikes the stone and splashes, faster and thicker with the chain.
    ...rainDraws({ idPrefix: 'storm-rain', count: realmLifeCount(190, depth, lean), t, floor: REALM_FLOORS.storm.band, alpha: 0.9 * alpha, seed: 101, pace: Math.sqrt(pace), crowns: !lean }),
    // The spray the rain throws up off the stone: a low haze over the whole floor, driven with the wind.
    fogDraw({ id: 'storm-spray', t, alpha: 0.3 * alpha, mask: { kind: 'band', top: 0.6, solidFrom: 0.78, solidTo: 0.97, bottom: 1 }, speed: 0.025 * pace, tileW: 0.7, seed: 17 }),
    // Water standing on the stone catches the light.
    ...glintDraws({ idPrefix: 'storm-puddle', points: STORM_PUDDLES, t, everyMs: 4000 / pace, lastsMs: 700, size: 0.045, alpha: 0.55 * alpha, seed: 104, cell: 'glint' }),
    ...glintDraws({ idPrefix: 'storm-rod', points: STORM_RODS, t, everyMs: 5200 / pace, lastsMs: 500, size: 0.06, alpha: 0.9 * alpha, seed: 103, cell: 'dotViolet' })
];

const groveLife = ({ t, depth, lean, alpha }: RealmRoomLifeInput, pace: number): SceneDraw[] => {
    const draws: SceneDraw[] = [
        ...driftDraws({ idPrefix: 'grove-spore', cell: 'dotSpore', count: realmLifeCount(16, depth, lean), x: 0.03, y: 0.1, w: 0.94, h: 0.75, fall: -0.008 * pace, slide: 0.004, size: 0.011, alpha: 0.7 * alpha, seed: 111 }, t),
        ...driftDraws({ idPrefix: 'grove-firefly', cell: 'dotFirefly', count: realmLifeCount(8, depth, lean), x: 0.08, y: 0.45, w: 0.84, h: 0.45, fall: -0.004 * pace, slide: 0.008 * pace, size: 0.016, alpha: 0.85 * alpha, seed: 113 }, t),
        // Leaves coming down through the roots, turning, and lying on the floor a while.
        ...landingDraws({ idPrefix: 'grove-leaf', cell: 'leaf', count: realmLifeCount(6, depth, lean), t, floor: REALM_FLOORS.grove.band, xMin: 0.08, xMax: 0.92, fromY: -0.04, fallS: 7 / pace, gravity: false, lieS: 5, gapS: 1.5, slide: 0.006, sway: 0.04, size: 0.026, alpha: 0.8 * alpha, seed: 117, blend: 'source-over', tumble: 1.3, lieScaleY: 0.55 }),
        ...crossingDraws({ id: 'grove-moth', cell: 'moth', t, everyMs: 21_000 / pace, lastsMs: 5200, seed: 121, fromX: 0.2, toX: 0.8, yMin: 0.3, yMax: 0.55, size: 0.028, alpha: 0.75 * alpha, bob: 0.02 }),
        fogDraw({ id: 'grove-mist', t, alpha: 0.26 * alpha, mask: { kind: 'band', top: 0.66, solidFrom: 0.82, solidTo: 0.96, bottom: 1 }, speed: 0.003 * pace, tileW: 1, seed: 15 })
    ];
    // The fungus pulses, each cap on its own slow beat, brighter with the chain.
    GROVE_FUNGI.forEach(([x, y], index) => {
        const pulse = 0.5 + 0.5 * Math.sin((t * pace) / (1500 + index * 270) + index * 2.3);
        draws.push(ambientSprite({ id: `grove-fungus-${index}`, cell: 'dotSpore', x, y, size: 0.035 + 0.02 * pulse, alpha: (0.25 + 0.5 * pulse) * alpha }));
    });
    return draws;
};

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

// ------------------------------------------------------------------ the painting's own layers

/**
 * How bright one of a realm room's lights is at a moment (`realmRoomArt.ts`: its glow families,
 * and the moving parts that carry their light). Every one climbs with the combo on its own soft
 * cap; each has its own life: the storm's painted lightning sits near dark and flashes with the live
 * strikes, its sky and puddles light with them, the braziers flicker, the shaft breathes, the fungus
 * pulses, the lava swells.
 */
export const realmLayerLevel = (realm: RealmId, family: string, t: number, depth: number): number => {
    const climb = comboSoftCap(depth, 1);
    const rest = 0.35 + 0.65 * climb;
    const breath = (period: number, offset = 0): number => 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / period + offset);
    if (realm === 'storm') {
        const strike = stormStrikeLevel(t, depth);
        const sheet = stormSheetLevel(t, depth);
        if (family === 'bolts') return 0.06 + 0.94 * strike;
        if (family === 'sky') return Math.min(1.2, 0.45 + 0.3 * climb + 0.6 * Math.max(strike, sheet * 0.6));
        if (family === 'puddles') return 0.35 + 0.25 * climb + 0.7 * strike;
        return rest * (0.9 + 0.1 * breath(5200)) + 0.3 * strike;
    }
    if (realm === 'ember') {
        if (family === 'braziers') return (0.7 + 0.3 * climb) * (0.82 + 0.18 * Math.sin(t / 97) * Math.sin(t / 233));
        if (family === 'lava') return rest * (0.85 + 0.15 * breath(3600));
        return rest * (0.9 + 0.1 * breath(4400, 1));
    }
    if (realm === 'tide') {
        if (family === 'shaft') return (0.55 + 0.35 * climb) * (0.8 + 0.2 * breath(6200));
        if (family === 'water') return rest * (0.85 + 0.15 * breath(2700));
        if (family === 'pillars') return 0.3 + 0.4 * climb;
        return rest;
    }
    if (realm === 'grove') {
        if (family === 'fungi') return (0.4 + 0.4 * climb) * (0.6 + 0.4 * breath(2300));
        if (family === 'canopy') return (0.55 + 0.3 * climb) * (0.8 + 0.2 * breath(7000));
        return rest;
    }
    // frost
    if (family === 'snow') return 0.6 + 0.2 * climb;
    if (family === 'ice') return (0.4 + 0.5 * climb) * (0.85 + 0.15 * breath(5200));
    return rest * (0.9 + 0.1 * breath(4800));
};

/**
 * A realm room's moving parts at a moment (`realm_layers.py`): each flipbook stepping on its own
 * clock, a little faster the deeper the chain; the ones moving the painting drawn over its base, the
 * ones moving a light added at that light's level.
 */
export const realmRoomSpriteDraws = (realm: RealmId, sprites: readonly SceneSpriteDef[], t: number, depth: number, alpha: number, still: boolean): SceneDraw[] => {
    if (alpha <= 0.004) return [];
    const pace = still ? 0 : Math.sqrt(realmLifePace(depth));
    return sprites.map((sprite, index) => {
        const frames = Math.max(1, sprite.frames);
        const frame = still ? 0 : Math.floor((t / 1000) * sprite.fps * pace + index * 0.37 * frames) % frames;
        const family = sprite.source?.startsWith('family:') ? sprite.source.slice(7) : null;
        const level = family ? realmLayerLevel(realm, family, t, depth) : 1;
        return {
            kind: 'image',
            id: `realm-part-${sprite.id}`,
            src: sprite.sheet,
            alpha: alpha * Math.min(1, level),
            blend: sprite.blend ?? 'source-over',
            rect: { x: sprite.x, y: sprite.y, w: sprite.w, h: sprite.h },
            frame: { index: frame, count: frames },
            depth: 1
        };
    });
};

// ------------------------------------------------------------------ the painting itself, moving

interface RealmWarp {
    id: string;
    /** The part of the painting that moves, fractions of the plate. */
    box: readonly [number, number, number, number];
    kind: 'ripple' | 'billow' | 'sway';
    /** For a sway: where it is rooted (vines hang from the top, ferns grow from the bottom). */
    anchor?: 'top' | 'bottom';
    phase?: number;
}

/** The parts of each painting that move as a whole: water, cloud, vines and ferns (no flipbook: the base itself, warped live). */
export const REALM_WARPS: Readonly<Record<RealmId, readonly RealmWarp[]>> = {
    frost: [],
    ember: [],
    tide: [{ id: 'water', box: [0, 0.64, 1, 1], kind: 'ripple' }],
    storm: [{ id: 'clouds', box: [0, 0, 1, 0.44], kind: 'billow' }],
    grove: [
        { id: 'vines-l', box: [0, 0, 0.32, 0.72], kind: 'sway', anchor: 'top' },
        { id: 'vines-r', box: [0.68, 0, 1, 0.72], kind: 'sway', anchor: 'top', phase: 0.45 },
        { id: 'ferns-l', box: [0, 0.62, 0.3, 1], kind: 'sway', anchor: 'bottom', phase: 0.2 },
        { id: 'ferns-r', box: [0.7, 0.62, 1, 1], kind: 'sway', anchor: 'bottom', phase: 0.7 }
    ]
};

/**
 * The painting's own moving parts, warped live from the room's base (2026-10-09): the region drawn
 * again in thin bands across it, each shifted a little along a wave that runs through the bands, so
 * the water ripples, the clouds churn and the vines sway from their roots - as sharp as the base on
 * any screen (a baked flipbook of them was soft on a phone), at the cost of a few dozen draws.
 * The bands at a region's top and bottom fade, so its edge never shows.
 */
export const realmRoomWarpDraws = (realm: RealmId, src: string, t: number, depth: number, alpha: number, lean: boolean): SceneDraw[] => {
    if (alpha <= 0.004 || !src) return [];
    const s = (t / 1000) * Math.sqrt(realmLifePace(depth));
    const out: SceneDraw[] = [];
    for (const warp of REALM_WARPS[realm]) {
        const [x0, y0, x1, y1] = warp.box;
        const bands = (lean ? 24 : 44) * (warp.kind === 'sway' ? 1 : 1);
        const bh = (y1 - y0) / bands;
        const phase = (warp.phase ?? 0) * Math.PI * 2;
        for (let band = 0; band < bands; band += 1) {
            const v = (band + 0.5) / bands;
            let dx: number;
            if (warp.kind === 'ripple') {
                // Water: small waves running across, larger nearer the camera.
                dx = (0.0011 + 0.0028 * v) * (Math.sin(v * 38 - s * 2.6 + phase) + 0.45 * Math.sin(v * 91 + s * 4.1));
            } else if (warp.kind === 'billow') {
                // Cloud: slow broad churning, rolling one way and back.
                dx = 0.0032 * Math.sin(v * 7 - s * 0.55 + phase) + 0.0016 * Math.sin(v * 17 + s * 0.9);
            } else {
                // Vines and ferns: rooted at one end, the free end swaying most, a gust now and then.
                const free = warp.anchor === 'bottom' ? 1 - v : v;
                const gust = 0.6 + 0.4 * Math.sin(s * 0.37 + phase * 2);
                dx = 0.0042 * free ** 1.6 * gust * (Math.sin(s * 1.15 + phase + v * 1.4) + 0.3 * Math.sin(s * 2.7 + v * 3));
            }
            const edge = Math.min(1, band / 3, (bands - 1 - band) / 3);
            out.push({
                kind: 'image',
                id: `realm-warp-${warp.id}-${band}`,
                src,
                alpha: alpha * (0.35 + 0.65 * Math.max(0, edge)),
                // A hair taller than the band, so no seam shows between neighbours.
                rect: { x: x0 + dx, y: y0 + band * bh, w: x1 - x0, h: bh * 1.04 },
                cropUv: { x: x0, y: y0 + band * bh, w: x1 - x0, h: bh * 1.04 },
                depth: 0
            });
        }
    }
    return out;
};
