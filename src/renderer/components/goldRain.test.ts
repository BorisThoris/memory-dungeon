import { describe, expect, it } from 'vitest';
import { buildGoldRain, GOLD_RAIN_LASTS_MS, GOLD_RAIN_MAX_COINS } from './goldRain';

describe('gold rain', () => {
    it('rains the same coins for the same payout, more for a bigger one, never past the cap', () => {
        expect(buildGoldRain('floor:3', 12)).toEqual(buildGoldRain('floor:3', 12));
        expect(buildGoldRain('floor:3', 12)).not.toEqual(buildGoldRain('floor:4', 12));
        expect(buildGoldRain('x', 12)).toHaveLength(12);
        expect(buildGoldRain('x', 500)).toHaveLength(GOLD_RAIN_MAX_COINS);
        expect(buildGoldRain('x', 0)).toHaveLength(0);
        for (const coin of buildGoldRain('y', 40)) {
            expect(coin.x).toBeGreaterThanOrEqual(4);
            expect(coin.x).toBeLessThanOrEqual(96);
            expect(coin.duration).toBeGreaterThan(0.7);
            expect(coin.depth).toBeGreaterThanOrEqual(0);
            expect(coin.depth).toBeLessThanOrEqual(1);
        }
    });

    it('lays the far coins down first, so a near one passes in front, and ends inside its hold', () => {
        const coins = buildGoldRain('z', 40);
        for (let index = 1; index < coins.length; index += 1) {
            expect(coins[index]!.depth).toBeLessThanOrEqual(coins[index - 1]!.depth);
        }
        const latest = Math.max(...coins.map((coin) => coin.delay + coin.duration));
        expect(latest * 1000).toBeLessThan(GOLD_RAIN_LASTS_MS);
    });
});
