import { describe, expect, it } from 'vitest';
import { mismatchFloaterLiveRegionText, mismatchFloaterVisualLabel } from './mismatchFloater';

describe('mismatchFloaterLiveRegionText', () => {
    it('returns stable phrase', () => {
        expect(mismatchFloaterLiveRegionText()).toBe('No match');
    });

    it('includes trait interaction text when present', () => {
        expect(mismatchFloaterLiveRegionText(['Cursed + Volatile: recall pressure'])).toBe(
            'No match. Cursed + Volatile: recall pressure'
        );
    });
});

describe('mismatchFloaterVisualLabel', () => {
    it('returns short board label', () => {
        expect(mismatchFloaterVisualLabel()).toBe('Miss');
    });
});
