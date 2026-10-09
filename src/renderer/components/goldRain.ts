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
export const GOLD_RAIN_FLOOR = { far: 0.79, near: 0.97 } as const;

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
/** How much of its speed a coin keeps off the stone, bounce to bounce. */
export const GOLD_COIN_RESTITUTION = 0.4;
export const GOLD_COIN_BOUNCES = 3;
/** Bounces are seen from above and far off: a fraction of their true height on the plate. */
const BOUNCE_VIEW = 0.4;
/** How long a coin rolls after it lands, its speed falling away. */
const ROLL_TAU_S = 0.35;

/** A floor on the plate: its far edge and its near edge, as fractions of the plate's height. */
export interface GoldFloorBand {
    far: number;
    near: number;
}

export const goldCoinFloorOn = (coin: GoldCoin, band: GoldFloorBand): number => band.near + (band.far - band.near) * coin.depth;

export interface GoldCoinMotion {
    /** The coin's lowest point, fraction of the plate's height. */
    bottom: number;
    /** How far it has rolled, plate widths. */
    roll: number;
    /** Downward speed, plate heights a second (for the smear). */
    speed: number;
    /** 0 in the air, rising to 1 as it settles flat. */
    flat: number;
    /** Seconds since it first struck the floor, or a negative number while still falling. */
    landed: number;
    /** How far above the floor it is, plate heights. */
    height: number;
    /** Seconds of turning it has done (it stops turning when it settles). */
    turnTime: number;
}

/** Where a coin is `seconds` after it began to fall, from `startY` onto `floor`. Pure; Infinity is at rest. */
export const goldCoinMotion = (coin: GoldCoin, seconds: number, startY: number, floor: number): GoldCoinMotion => {
    const fallS = coin.duration;
    const drop = floor - startY;
    const g = (2 * drop) / (fallS * fallS);
    const v0 = g * fallS;
    // Each bounce's air time, and when the coin is finally down.
    const airs: number[] = [];
    for (let bounce = 1; bounce <= GOLD_COIN_BOUNCES; bounce += 1) airs.push((2 * v0 * GOLD_COIN_RESTITUTION ** bounce) / g);
    const bouncingS = airs.reduce((sum, s) => sum + s, 0);
    const rollSpeed = (((coin.phase * 7.13) % 1) - 0.5) * 0.06 * (1 - 0.5 * coin.depth);
    const restRoll = rollSpeed * ROLL_TAU_S;
    if (!Number.isFinite(seconds)) {
        return { bottom: floor, roll: restRoll, speed: 0, flat: 1, landed: Number.POSITIVE_INFINITY, height: 0, turnTime: fallS + bouncingS * 0.5 };
    }
    if (seconds < fallS) {
        const p = Math.max(0, seconds) / fallS;
        return { bottom: startY + drop * p * p, roll: 0, speed: (2 * drop * p) / fallS, flat: 0, landed: seconds - fallS, height: drop * (1 - p * p), turnTime: seconds };
    }
    const landed = seconds - fallS;
    const roll = rollSpeed * ROLL_TAU_S * (1 - Math.exp(-landed / ROLL_TAU_S));
    const view = BOUNCE_VIEW * (1 - 0.5 * coin.depth);
    let into = landed;
    for (let bounce = 0; bounce < airs.length; bounce += 1) {
        const air = airs[bounce]!;
        if (into < air) {
            const v = v0 * GOLD_COIN_RESTITUTION ** (bounce + 1);
            const height = (v * into - 0.5 * g * into * into) * view;
            return { bottom: floor - height, roll, speed: 0, flat: 0, landed, height, turnTime: fallS + into * 0.5 + bounce * 0.1 };
        }
        into -= air;
    }
    // Down: it rocks onto its face and lies there.
    const flat = Math.min(1, into / 0.22);
    return { bottom: floor, roll, speed: 0, flat, landed, height: 0, turnTime: fallS + bouncingS * 0.5 };
};
