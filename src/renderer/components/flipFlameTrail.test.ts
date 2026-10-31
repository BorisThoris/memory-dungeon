import { describe, expect, it } from 'vitest';
import { FLIP_FLAME_BASE, FLIP_FLAME_CEILING, FLIP_FLAME_SPAN, flipFlameCount, flipFlameTrail } from './flipFlameTrail';

describe('flipFlameTrail', () => {
    it('lights only from Blazing', () => {
        expect(flipFlameCount(0)).toBe(0);
        expect(flipFlameCount(9)).toBe(0);
        expect(flipFlameCount(10)).toBe(FLIP_FLAME_BASE);
        expect(flipFlameTrail(9, 1, 0.5)).toEqual([]);
    });

    it('climbs with every stage and never passes its ceiling', () => {
        const counts = [10, 16, 25, 50, 100, 1000, 100000].map(flipFlameCount);
        for (let i = 1; i < counts.length; i += 1) expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]!);
        expect(counts[1]).toBeGreaterThan(counts[0]!);
        expect(counts[3]).toBeGreaterThan(counts[1]!);
        expect(counts.at(-1)).toBeLessThanOrEqual(FLIP_FLAME_BASE + FLIP_FLAME_CEILING);
    });

    it('lays the trail across the card over the turn, the same for the same seed', () => {
        const trail = flipFlameTrail(40, 1234, 0.5);
        expect(trail).toHaveLength(flipFlameCount(40));
        expect(trail).toEqual(flipFlameTrail(40, 1234, 0.5));
        expect(trail[0]!.dx).toBeLessThan(0);
        expect(trail.at(-1)!.dx).toBeGreaterThan(0);
        for (const ember of trail) expect(ember.delay).toBeLessThanOrEqual(FLIP_FLAME_SPAN + 0.03);
    });

    it('burns bigger the deeper the combo', () => {
        const mean = (combo: number) => {
            const trail = flipFlameTrail(combo, 7, 0.5);
            return trail.reduce((sum, ember) => sum + ember.sizeScale, 0) / trail.length;
        };
        expect(mean(200)).toBeGreaterThan(mean(10));
    });
});
