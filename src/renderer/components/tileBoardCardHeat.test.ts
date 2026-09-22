import { describe, expect, it } from 'vitest';
import { CARD_BREAK_DROP, cardBreakSnuff, cardHeatLevels, cardMatchFlare } from './tileBoardCardHeat';

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

    it('reports only what the board draws: no field is computed and left unread', () => {
        expect(Object.keys(cardHeatLevels(0.5)).sort()).toEqual(['runeGlow', 'spin', 'spinRate']);
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

describe('cardBreakSnuff', () => {
    it('pulls the light under its resting level, then brings it back', () => {
        // The moment of the break is the darkest the card ever is.
        expect(cardBreakSnuff(0)).toBeLessThan(0.3);
        expect(cardBreakSnuff(0.05)).toBe(cardBreakSnuff(0));
        // It recovers, and only upward.
        let last = cardBreakSnuff(0.1);
        for (let step = 1; step <= 12; step += 1) {
            const next = cardBreakSnuff(0.1 + step * 0.05);
            expect(next).toBeGreaterThanOrEqual(last);
            last = next;
        }
        expect(cardBreakSnuff(1)).toBe(1);
        expect(cardBreakSnuff(9)).toBe(1);
    });

    it('never dims a card that has not broken', () => {
        expect(cardBreakSnuff(-1)).toBe(1);
        expect(cardBreakSnuff(Number.NaN)).toBe(1);
    });

    it('triggers on a lost chain and not on the meter easing', () => {
        // A mismatch empties the meter, so the fall is far larger than the threshold; nothing else
        // moves it down at all.
        const fever = cardHeatLevels(1);
        expect(fever.runeGlow).toBe(1);
        expect(CARD_BREAK_DROP).toBeGreaterThan(0);
        expect(CARD_BREAK_DROP).toBeLessThan(0.5);
    });
});
