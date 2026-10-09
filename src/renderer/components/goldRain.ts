import { createMulberry32, hashStringToSeed } from '../../shared/rng';

/**
 * Gold rain: coins falling through the room on a payout, in front of the stone and behind the
 * cards. This is the shower itself, laid out from the payout's key so the same payout rains the
 * same coins; the room's canvas draws it (`goldRainDraws` in `gameplaySceneFrame.ts`) from the
 * baked coin's turn (`bake_ambient.py`). It used to be an SVG per coin, each with a drop-shadow
 * filter, ninety of them animating at once on a big payout.
 *
 * A coin falls the way a coin does: from rest, faster and faster, onto the floor of the room, and
 * where it lands says how far away it is. A near coin is bigger and lands low on the plate; a far
 * one is smaller and lands up by the ring. It hops once, settles, and goes out.
 */
export const GOLD_RAIN_MAX_COINS = 90;

/** The latest a coin starts falling, seconds after the payout. */
const GOLD_RAIN_SPREAD_S = 0.9;
/** The longest a coin falls. */
const GOLD_RAIN_FALL_MAX_S = 1.25;
/** After landing: the hop, the rest on the stone, and going out. */
export const GOLD_RAIN_HOP_S = 0.26;
export const GOLD_RAIN_REST_S = 0.3;
export const GOLD_RAIN_FADE_S = 0.4;
/** How long a shower lasts from the payout to the last coin gone, so the room can hold it after the beat. */
export const GOLD_RAIN_LASTS_MS = Math.ceil((GOLD_RAIN_SPREAD_S + GOLD_RAIN_FALL_MAX_S + GOLD_RAIN_HOP_S + GOLD_RAIN_REST_S + GOLD_RAIN_FADE_S) * 1000);

/** Where the floor of the room is on the plate: the far edge by the ring, the near edge at the bottom. */
export const GOLD_RAIN_FLOOR = { far: 0.79, near: 0.97, horizon: 0.5, focal: 0.86 } as const;

export interface GoldCoin {
    /** Across the plate, percent. */
    x: number;
    /** Seconds after the payout it starts to fall. */
    delay: number;
    /** Seconds from the top of the plate to the floor. */
    duration: number;
    /** 0 is the near edge of the floor, 1 the far edge. */
    depth: number;
    /** Half-turns a second, signed. */
    spin: number;
    /** Where in its turn it starts, 0..1. */
    phase: number;
}

export const buildGoldRain = (rainKey: string, coins: number): GoldCoin[] => {
    const rng = createMulberry32(hashStringToSeed(`gold-rain:${rainKey}`));
    const count = Math.max(0, Math.min(GOLD_RAIN_MAX_COINS, Math.round(coins)));
    const out: GoldCoin[] = [];
    for (let index = 0; index < count; index += 1) {
        const depth = rng();
        out.push({
            x: 4 + rng() * 92,
            delay: rng() * GOLD_RAIN_SPREAD_S,
            // A far coin has less far to fall.
            duration: GOLD_RAIN_FALL_MAX_S - 0.3 * depth - rng() * 0.15,
            depth,
            spin: (rng() > 0.5 ? 1 : -1) * (2.2 + rng() * 2.4),
            phase: rng()
        });
    }
    // The far ones first, so a near coin passes in front of a far one and never behind it.
    return out.sort((a, b) => b.depth - a.depth);
};

/** Where a coin lands, as a fraction of the plate's height. */
export const goldCoinFloor = (coin: GoldCoin): number => GOLD_RAIN_FLOOR.near + (GOLD_RAIN_FLOOR.far - GOLD_RAIN_FLOOR.near) * coin.depth;

/** A coin's height on the plate, as a fraction of the plate's height: near coins are larger. */
export const goldCoinSize = (coin: GoldCoin): number => 0.06 - 0.026 * coin.depth;

/**
 * Gold that lands and stays (2026-10-09, the owner: "the coin drop effect needs to drop physical gold
 * that falls on the floor"). A coin no longer hops and goes out: it falls under gravity, strikes the
 * floor and bounces, lower each time, rolls a little and slows, and lies there flat for as long as
 * the run stays in that room, every payout's gold piling up with the last (`GOLD_PILE_SLOTS` showers, the newest
 * `GOLD_PILE_MAX_COINS` coins). On water (the Drowned Vault) it splashes and sinks, and its glint
 * stays under the surface.
 */
export const GOLD_PILE_SLOTS = 24;

/** One payout lying in the room: its shower, and the slot its clock runs in. */
export interface GoldPileShower {
    key: string;
    coins: number;
    slot: number;
}
export const GOLD_PILE_MAX_COINS = 240;

/**
 * A floor on the plate: its far edge and near edge (fractions of the plate's height), and the
 * horizon (the camera's eye level on the painting). Perspective follows from the horizon: a thing on
 * the floor is smaller the closer its foot is to it, and a coin lying flat is foreshortened by how
 * far below the horizon it lies.
 */
export interface GoldFloorBand {
    far: number;
    near: number;
    horizon?: number;
    /**
     * The camera's focal length in plate heights: a flat disc lying at plate height y looks
     * (y - horizon) / focal as tall as it is wide, on screen. Measured from the painting's rune ring
     * (its pixel height over its pixel width at its height): the dungeon ring is 0.266 at y 0.729
     * under a horizon at 0.5, so 0.86.
     */
    focal?: number;
}

const DUNGEON_HORIZON = 0.5;
const DUNGEON_FOCAL = 0.86;

export const goldCoinFloorOn = (coin: GoldCoin, band: GoldFloorBand): number => band.near + (band.far - band.near) * coin.depth;

/** How a disc lying on the floor at plate height `y` is foreshortened (its height over its width). */
export const floorForeshortening = (y: number, band: GoldFloorBand): number =>
    Math.max(0.05, Math.min(0.9, (y - (band.horizon ?? DUNGEON_HORIZON)) / (band.focal ?? DUNGEON_FOCAL)));

/** How big a thing standing at plate height `y` on the floor is, against one at the near edge. */
export const floorScale = (y: number, band: GoldFloorBand): number => {
    const horizon = band.horizon ?? DUNGEON_HORIZON;
    return Math.max(0.12, (y - horizon) / Math.max(0.05, band.near - horizon));
};

/** A coin's radius at the near edge of the floor, in plate heights. */
export const GOLD_COIN_RADIUS = 0.03;
/** Gravity, in near-floor plate heights a second squared: a coin from the top of the room lands in about 0.7 s. */
const GRAVITY = 4.2;
/** How much of its fall a coin keeps off the stone. */
export const GOLD_COIN_RESTITUTION = 0.3;
const SIM_HZ = 240;
const SAMPLE_HZ = 60;

/**
 * One coin's flight, worked out once (a small physics step at 240 Hz, kept at 60 Hz): it falls from
 * above the room under gravity, tumbling end over end about an axis of its own; each strike on the
 * stone throws it back up with less of its speed, kicks its tumble one way or the other and takes
 * some of its slide; once a bounce is too small to leave the floor it is down on its edge or its face
 * and spins down like a coin on a table, the wobble fast and shallow until it lies flat. Pure and
 * seeded by the coin, so the same payout falls the same way.
 *
 * Per sample: across (plate widths), depth (0 near .. 1 far), height above the floor (near-floor
 * plate heights), the tilt of its face from flat (radians), the bearing of that tilt, and whether
 * it has struck the floor yet.
 */
export interface GoldCoinPath {
    /** Seconds from the start of the fall to the first strike and to lying still. */
    landS: number;
    restS: number;
    /** Samples: x, depth, height, tilt, bearing per frame. */
    samples: Float32Array;
}

const rand = (coin: GoldCoin, salt: number): number => {
    const v = Math.sin((coin.x * 12.9898 + coin.depth * 78.233 + coin.phase * 37.719 + salt * 4.1414) * 43758.5453);
    return v - Math.floor(v);
};

export const goldCoinPath = (coin: GoldCoin, band: GoldFloorBand): GoldCoinPath => {
    const yFloor = goldCoinFloorOn(coin, band);
    const scale = floorScale(yFloor, band);
    const r = GOLD_COIN_RADIUS;
    // From just above the top of the plate: its height in near-floor units at its own depth.
    let h = (yFloor + 0.08) / scale;
    let x = coin.x / 100;
    let depth = coin.depth;
    let vh = 0;
    let vx = (rand(coin, 1) - 0.5) * 0.05;
    let vd = (rand(coin, 2) - 0.5) * 0.06;
    let tilt = rand(coin, 3) * Math.PI * 2;
    let spin = (rand(coin, 4) > 0.5 ? 1 : -1) * (7 + 8 * rand(coin, 5));
    let bearing = rand(coin, 6) * Math.PI * 2;
    let bearingRate = (rand(coin, 7) - 0.5) * 1.5;
    let landS = -1;
    let settling = -1;
    let settleTilt = 0;
    let restS = -1;
    const samples: number[] = [];
    const every = SIM_HZ / SAMPLE_HZ;
    const dt = 1 / SIM_HZ;
    for (let step = 0; step < SIM_HZ * 6; step += 1) {
        const time = step * dt;
        if (step % every === 0) samples.push(x, depth, h, tilt, bearing);
        if (restS >= 0) break;
        if (settling < 0) {
            vh -= GRAVITY * dt;
            h += vh * dt;
            x += vx * dt;
            depth = Math.max(0, Math.min(1, depth + vd * dt));
            tilt += spin * dt;
            bearing += bearingRate * dt;
            // Its lowest point is its rim, as far below its centre as the tilt stands it up.
            const reach = r * Math.abs(Math.sin(tilt));
            if (h - reach <= 0 && vh < 0) {
                if (landS < 0) landS = time;
                h = reach;
                const impact = -vh;
                vh = impact * GOLD_COIN_RESTITUTION;
                spin = spin * 0.45 + (rand(coin, 10 + step) - 0.5) * 18 * impact;
                vx *= 0.6;
                vd *= 0.6;
                bearingRate += (rand(coin, 20 + step) - 0.5) * 3;
                // Too little to leave the floor: it is down, on whatever side it fell.
                if (vh < 0.22) {
                    settling = time;
                    settleTilt = Math.acos(Math.abs(Math.cos(tilt)));
                    tilt = settleTilt;
                }
            }
        } else {
            // Spinning down: the tilt sinks, and the wobble round it quickens as it does (Euler's disk).
            const since = time - settling;
            tilt = settleTilt * Math.exp(-since / 0.22);
            bearing += Math.min(45, 5 + 3 / Math.sqrt(Math.max(tilt, 0.002))) * dt;
            h = r * Math.sin(tilt);
            x += vx * Math.exp(-since / 0.2) * dt;
            if (tilt < 0.004) {
                tilt = 0;
                h = 0;
                restS = time;
                samples.push(x, depth, h, tilt, bearing);
            }
        }
    }
    if (landS < 0) landS = samples.length / 5 / SAMPLE_HZ;
    if (restS < 0) restS = samples.length / 5 / SAMPLE_HZ;
    return { landS, restS, samples: Float32Array.from(samples) };
};

export interface GoldCoinPose {
    x: number;
    depth: number;
    height: number;
    tilt: number;
    bearing: number;
    /** Seconds since it first struck the floor (negative while still falling). */
    landed: number;
    /** It has come to rest. */
    still: boolean;
}

/** Where a coin is `seconds` into its flight (`Infinity`: lying where it came to rest). */
export const goldCoinPose = (path: GoldCoinPath, seconds: number): GoldCoinPose => {
    const count = path.samples.length / 5;
    const at = Number.isFinite(seconds) ? Math.max(0, seconds) * SAMPLE_HZ : count - 1;
    const i = Math.min(count - 1, Math.floor(at));
    const j = Math.min(count - 1, i + 1);
    const f = Math.min(1, at - i);
    const s = path.samples;
    const lerp = (k: number): number => s[i * 5 + k]! + (s[j * 5 + k]! - s[i * 5 + k]!) * f;
    return {
        x: lerp(0),
        depth: lerp(1),
        height: Math.max(0, lerp(2)),
        tilt: lerp(3),
        bearing: lerp(4),
        landed: (Number.isFinite(seconds) ? seconds : path.restS + 1) - path.landS,
        still: !Number.isFinite(seconds) || seconds >= path.restS
    };
};

/**
 * How the coin looks from the camera at a pose: which frame of its turn (`bake_coin.py`: 0 face-on
 * to the last, its back face-on) and how far to rotate it, from its face's normal against the view.
 */
export const goldCoinView = (pose: GoldCoinPose, band: GoldFloorBand): { turn: number; rotate: number; foreshortening: number } => {
    const yFloor = band.near + (band.far - band.near) * pose.depth;
    const sinA = floorForeshortening(yFloor, band);
    const cosA = Math.sqrt(1 - sinA * sinA);
    const nx = Math.sin(pose.tilt) * Math.sin(pose.bearing);
    const ny = Math.cos(pose.tilt);
    const nz = Math.sin(pose.tilt) * Math.cos(pose.bearing);
    const facing = ny * sinA + nz * cosA;
    // 0 face-on, 0.5 edge-on, 1 its back face-on.
    const turn = Math.acos(Math.max(-1, Math.min(1, facing))) / Math.PI;
    const sx = nx;
    const sy = ny * cosA - nz * sinA;
    const rotate = Math.hypot(sx, sy) < 1e-4 ? 0 : -Math.atan2(sx, sy);
    return { turn, rotate, foreshortening: sinA };
};
