import { describe, expect, it } from 'vitest';
import { matchScoreFloaterLiveRegionText } from './matchScoreFloater';

describe('matchScoreFloaterLiveRegionText', () => {
    it('formats amount with locale stringing', () => {
        expect(matchScoreFloaterLiveRegionText(99)).toMatch(/^Plus 99 points$/);
    });

    it('includes trait interaction text when present', () => {
        expect(matchScoreFloaterLiveRegionText(99, ['Echo + Sealed: combo shard'])).toBe(
            'Plus 99 points. Echo + Sealed: combo shard'
        );
    });
});
