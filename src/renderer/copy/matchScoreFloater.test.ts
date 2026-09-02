import { describe, expect, it } from 'vitest';
import { matchScoreFloaterChainCue, matchScoreFloaterLiveRegionText } from './matchScoreFloater';

describe('matchScoreFloaterLiveRegionText', () => {
    it('announces the amount alone when nothing else is worth saying', () => {
        expect(matchScoreFloaterLiveRegionText(99)).toBe('Plus 99 points');
        expect(matchScoreFloaterLiveRegionText(1200)).toBe('Plus 1,200 points');
    });

    it('normalizes a malformed amount and chain depth instead of announcing NaN', () => {
        expect(matchScoreFloaterLiveRegionText(Number.NaN)).toBe('Plus 0 points');
        expect(
            matchScoreFloaterLiveRegionText(Number.POSITIVE_INFINITY, {
                chainDepth: Number.NaN,
                headline: 'Score pop'
            })
        ).toBe('Score pop. Plus 0 points');
        expect(matchScoreFloaterLiveRegionText(25, { chainDepth: Number.POSITIVE_INFINITY, headline: 'Combo' })).toBe(
            'Combo. Plus 25 points'
        );
    });

    it('leads with the headline and names the streak once it is worth calling out', () => {
        expect(matchScoreFloaterLiveRegionText(99, { chainDepth: 6, headline: 'Surge' })).toBe(
            'Surge. Plus 99 points. 6 match streak'
        );
        // Below three, the streak is not news.
        expect(matchScoreFloaterLiveRegionText(99, { chainDepth: 2, headline: 'Chain' })).toBe(
            'Chain. Plus 99 points'
        );
    });

    it('says the same single reason the floater shows, with no trailing stop', () => {
        expect(
            matchScoreFloaterLiveRegionText(99, {
                chainDepth: 6,
                headline: 'Surge',
                reason: 'Echo + Sealed: combo shard.'
            })
        ).toBe('Surge. Plus 99 points. 6 match streak. Echo + Sealed: combo shard');
    });

    it('still exposes the chain momentum cue the floater falls back to', () => {
        expect(typeof matchScoreFloaterChainCue(6)).toBe('string');
    });
});
