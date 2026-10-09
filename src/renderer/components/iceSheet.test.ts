import { describe, expect, it } from 'vitest';
import { buildIceCracks, inIceFrameBand } from './iceSheet';

describe('the ice sheet\'s cracks', () => {
    it('cracks the same way for the same seed, and differently for another', () => {
        const a = buildIceCracks(14);
        expect(a).toEqual(buildIceCracks(14));
        expect(a.map((crack) => crack.d).join()).not.toBe(buildIceCracks(15).map((crack) => crack.d).join());
        expect(a.length).toBeGreaterThanOrEqual(9);
        expect(a.some((crack) => crack.fork)).toBe(true);
    });

    it('runs in from the frame and stays in the band around it, never across the board', () => {
        for (const crack of [4, 14, 99].flatMap((seed) => buildIceCracks(seed))) {
            expect(crack.length).toBeGreaterThan(0);
            const points = [...crack.d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[2]), Number(match[3])]);
            expect(points.length).toBeGreaterThanOrEqual(2);
            for (const [x, y] of points) expect(inIceFrameBand(x!, y!), crack.d).toBe(true);
        }
    });
});
