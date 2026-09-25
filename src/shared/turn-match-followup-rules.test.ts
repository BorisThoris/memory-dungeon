import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchFollowup } from './turn-match-followup-rules';

describe('resolveTurnMatchFollowup', () => {
    it('counts the match and carries no anchor when the mutator is off', () => {
        const run = { ...createNewRun(0), nBackMatchCounter: 1, nBackAnchorPairKey: 'previous' };

        const result = resolveTurnMatchFollowup({
            run,
            encoreKey: 'sun'
        });

        expect(result.nBackMatchCounter).toBe(2);
        expect(result.nBackAnchorPairKey).toBeNull();
    });

    it('keeps the current anchor on the anchor floor; the next one is chosen on the post-turn board (n-back-anchor-rules)', () => {
        const run = {
            ...createNewRun(0, { activeMutators: ['n_back_anchor'] }),
            nBackMatchCounter: 1,
            nBackAnchorPairKey: 'sun'
        };

        const result = resolveTurnMatchFollowup({
            run,
            encoreKey: 'moon:encore'
        });

        expect(result.nBackMatchCounter).toBe(2);
        // Gen 263: the anchor is no longer the pair just matched (a pair already off the board).
        expect(result.nBackAnchorPairKey).toBe('sun');
    });

    it('normalizes malformed n-back counters before advancing follow-up state', () => {
        const run = {
            ...createNewRun(0, { activeMutators: ['n_back_anchor'] }),
            nBackMatchCounter: Number.NaN,
            nBackAnchorPairKey: 'previous'
        };

        const result = resolveTurnMatchFollowup({
            run,
            encoreKey: 'star:encore'
        });

        expect(result.nBackMatchCounter).toBe(1);
        expect(result.nBackAnchorPairKey).toBe('previous');
    });
});
