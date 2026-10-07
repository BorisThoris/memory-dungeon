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
