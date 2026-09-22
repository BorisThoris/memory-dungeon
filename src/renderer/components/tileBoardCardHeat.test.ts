import { describe, expect, it } from 'vitest';
import { cardHeatLevels, cardMatchFlare } from './tileBoardCardHeat';

describe('cardHeatLevels', () => {
    it('winds the board up with the chain, and every step of fill is felt', () => {
        let last = cardHeatLevels(0);
        expect(last.spin).toBe(0);
        for (let step = 1; step <= 20; step += 1) {
            const next = cardHeatLevels(step / 20);
            expect(next.runeGlow).toBeGreaterThan(last.runeGlow);
            expect(next.spinRate).toBeGreaterThanOrEqual(last.spinRate);
            expect(next.spin).toBeGreaterThanOrEqual(last.spin);
            last = next;
        }
        // At Fever the light is full and the medallion is turning at its fastest.
        expect(last.runeGlow).toBe(1);
        expect(last.spin).toBeGreaterThan(0.85);
        expect(last.spinRate).toBeGreaterThan(cardHeatLevels(0).spinRate * 3);
    });

    it('holds the medallion still until a chain is real, then accelerates', () => {
        expect(cardHeatLevels(0).spin).toBe(0);
        expect(cardHeatLevels(0.1).spin).toBe(0);
        expect(cardHeatLevels(0.3).spin).toBeGreaterThan(0);
        expect(cardHeatLevels(0.3).spin).toBeLessThan(cardHeatLevels(0.7).spin);
    });

    it('keeps a resting board lit rather than dead, and clamps bad input', () => {
        // A chain of nothing still shows the painting's own light, or the backs read as cardboard.
        expect(cardHeatLevels(0).runeGlow).toBeGreaterThan(0.15);
        expect(cardHeatLevels(Number.NaN)).toEqual(cardHeatLevels(0));
        expect(cardHeatLevels(4)).toEqual(cardHeatLevels(1));
        expect(cardHeatLevels(-2)).toEqual(cardHeatLevels(0));
    });
});

describe('cardMatchFlare', () => {
    it('spikes then falls away, and is bigger the further the chain has come', () => {
        expect(cardMatchFlare(0, 1)).toBe(0);
        const peakCold = cardMatchFlare(0.07, 0);
        const peakHot = cardMatchFlare(0.07, 1);
        expect(peakHot).toBeGreaterThan(peakCold);
        // It is over quickly: a pop, not a mood.
        expect(cardMatchFlare(0.4, 1)).toBeLessThan(peakHot);
        expect(cardMatchFlare(0.8, 1)).toBe(0);
        expect(cardMatchFlare(5, 1)).toBe(0);
    });

    it('never answers a nonsense age', () => {
        expect(cardMatchFlare(-1, 1)).toBe(0);
        expect(cardMatchFlare(Number.NaN, 1)).toBe(0);
    });
});
