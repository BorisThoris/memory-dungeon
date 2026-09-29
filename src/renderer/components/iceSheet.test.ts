import { describe, expect, it } from 'vitest';
import { buildIceCracks, ICE_SHEET_VIEWBOX } from './iceSheet';

describe('the ice sheet\'s cracks', () => {
    it('cracks the same way for the same seed, and differently for another', () => {
        const a = buildIceCracks(14);
        expect(a).toEqual(buildIceCracks(14));
        expect(a.map((crack) => crack.d).join()).not.toBe(buildIceCracks(15).map((crack) => crack.d).join());
        expect(a.length).toBeGreaterThanOrEqual(9);
        expect(a.some((crack) => crack.fork)).toBe(true);
    });

    it('runs in from the frame and stops short of the board', () => {
        const { width, height } = ICE_SHEET_VIEWBOX;
        for (const crack of buildIceCracks(4)) {
            expect(crack.length).toBeGreaterThan(0);
            const points = [...crack.d.matchAll(/([ML])(-?[\d.]+) (-?[\d.]+)/g)].map((match) => [Number(match[2]), Number(match[3])]);
            expect(points.length).toBeGreaterThanOrEqual(2);
            for (const [x, y] of points) {
                const inBoard = Math.abs(x! - width / 2) < width * 0.22 && Math.abs(y! - height / 2) < height * 0.28;
                expect(inBoard, crack.d).toBe(false);
            }
        }
    });
});
