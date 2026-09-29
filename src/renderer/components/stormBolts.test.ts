import { describe, expect, it } from 'vitest';
import { buildStormBolts, STORM_VIEWBOX } from './stormBolts';

describe('the storm\'s bolts', () => {
    it('come down from the vault into the room, the same for a seed', () => {
        const bolts = buildStormBolts(30);
        expect(bolts).toEqual(buildStormBolts(30));
        expect(bolts).toHaveLength(3);
        expect(bolts.map((bolt) => bolt.d).join()).not.toBe(buildStormBolts(31).map((bolt) => bolt.d).join());
        for (const bolt of bolts) {
            const points = [...bolt.d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[2]), Number(match[3])]);
            expect(points.length).toBeGreaterThan(6);
            expect(bolt.length).toBeGreaterThan(0);
            // Starts near the top, ends in the room's middle band, never leaves the plate.
            expect(points[0]![1]).toBeLessThan(STORM_VIEWBOX.height * 0.12);
            expect(points[points.length - 1]![1]).toBeGreaterThan(STORM_VIEWBOX.height * 0.35);
            for (const [x, y] of points) {
                expect(x).toBeGreaterThanOrEqual(0);
                expect(x).toBeLessThanOrEqual(STORM_VIEWBOX.width);
                expect(y).toBeLessThanOrEqual(STORM_VIEWBOX.height);
            }
        }
    });
});
