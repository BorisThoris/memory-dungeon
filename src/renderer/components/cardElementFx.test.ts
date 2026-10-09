import { describe, expect, it } from 'vitest';
import { CARD_ELEMENT_FX_SECONDS, cardElementFxOf } from './cardElementFx';

describe('a card going its element\'s way', () => {
    it('liquefies a water card, combusts a fire card and gives a growth card its spurt; ice and stone shatter instead', () => {
        expect(cardElementFxOf('tide')).toBe('liquefy');
        expect(cardElementFxOf('ember')).toBe('combust');
        expect(cardElementFxOf('moss')).toBe('sprout');
        expect(cardElementFxOf('bone')).toBeNull();
        expect(cardElementFxOf(undefined)).toBeNull();
    });

    it('is over within two and a half seconds', () => {
        for (const seconds of Object.values(CARD_ELEMENT_FX_SECONDS)) expect(seconds).toBeLessThanOrEqual(2.5);
    });
});
