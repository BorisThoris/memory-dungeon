import { describe, expect, it } from 'vitest';
import { plasmaRailLook } from './plasmaRailLook';

describe('plasma rail look', () => {
    it('is a still hairline cold, thickens with the heat and drips from Hot', () => {
        expect(plasmaRailLook(0)).toMatchObject({ width: 1, drips: 0 });
        expect(plasmaRailLook(3).drips).toBe(0);
        expect(plasmaRailLook(6).drips).toBeGreaterThan(0);
        expect(plasmaRailLook(16).width).toBeGreaterThan(plasmaRailLook(6).width);
    });

    it('keeps climbing on deep chains without running away', () => {
        const depths = [25, 75, 125, 225, 425, 825, 5000].map((combo) => plasmaRailLook(combo));
        for (let i = 1; i < depths.length; i += 1) expect(depths[i]!.width).toBeGreaterThanOrEqual(depths[i - 1]!.width);
        expect(depths.at(-1)!.width).toBeGreaterThan(depths[0]!.width);
        expect(depths.at(-1)!.width).toBeLessThan(6.5);
        expect(depths.at(-1)!.glow).toBeLessThanOrEqual(1);
        expect(depths.at(-1)!.drips).toBeLessThan(8);
    });
});
