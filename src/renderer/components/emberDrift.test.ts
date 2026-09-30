import { describe, expect, it } from 'vitest';
import { buildEmberDrift, EMBER_MOTES_BASE, EMBER_MOTES_MAX, EMBER_VIEWBOX, emberMoteCount } from './emberDrift';

describe('the ember run\'s weather', () => {
    it('is the same drift for the same seed, and a different one for another', () => {
        expect(buildEmberDrift(90_210)).toEqual(buildEmberDrift(90_210));
        expect(buildEmberDrift(90_210)).not.toEqual(buildEmberDrift(14));
    });

    it('rises off the floor band, inside the plate, some of it sparks and some ash', () => {
        const motes = buildEmberDrift(7, 200);
        const { width, height } = EMBER_VIEWBOX;
        for (const mote of motes) {
            expect(mote.x).toBeGreaterThanOrEqual(0);
            expect(mote.x).toBeLessThanOrEqual(width);
            expect(mote.y).toBeGreaterThan(height * 0.7);
            expect(mote.rise).toBeGreaterThan(0);
            expect(mote.duration).toBeGreaterThan(0);
        }
        expect(motes.some((mote) => mote.spark)).toBe(true);
        expect(motes.some((mote) => !mote.spark)).toBe(true);
    });

    it('thickens with the surge, to a ceiling', () => {
        expect(emberMoteCount(0)).toBe(EMBER_MOTES_BASE);
        expect(emberMoteCount(2)).toBeGreaterThan(EMBER_MOTES_BASE);
        expect(emberMoteCount(1000)).toBe(EMBER_MOTES_MAX);
    });
});
