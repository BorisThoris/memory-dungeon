import { createMulberry32, hashStringToSeed } from '../../shared/rng';

/**
 * Gold rain: coins falling through the room on a payout, in front of the stone and behind the
 * cards. This is the shower itself, laid out from the payout's key so the same payout rains the
 * same coins; the room's canvas draws it (`goldRainDraws` in `gameplaySceneFrame.ts`) from one
 * baked coin. It used to be an SVG per coin, each with a drop-shadow filter, ninety of them
 * animating at once on a big payout.
 */
export const GOLD_RAIN_MAX_COINS = 90;

export interface GoldCoin {
    x: number;
    delay: number;
    duration: number;
    size: number;
    spin: number;
}

export const buildGoldRain = (rainKey: string, coins: number): GoldCoin[] => {
    const rng = createMulberry32(hashStringToSeed(`gold-rain:${rainKey}`));
    const count = Math.max(0, Math.min(GOLD_RAIN_MAX_COINS, Math.round(coins)));
    const out: GoldCoin[] = [];
    for (let index = 0; index < count; index += 1) {
        out.push({
            x: 4 + rng() * 92,
            delay: rng() * 0.9,
            duration: 1.3 + rng() * 0.9,
            size: 0.9 + rng() * 0.9,
            spin: rng() > 0.5 ? 1 : -1
        });
    }
    return out;
};
