import { describe, expect, it } from 'vitest';
import { labelsAreAmbiguous, normalizeControlLabel } from '../../scripts/control-label-ambiguity';

describe('labelsAreAmbiguous', () => {
    it('catches the pair that shipped', () => {
        // The vendor's two exits, adjacent, one styled as the primary, both running the same action.
        expect(labelsAreAmbiguous('Back to board', 'Return to board')).toBe(true);
    });

    it('leaves two different destinations alone', () => {
        // Only the gesture is folded — these go to different places and should read differently.
        expect(labelsAreAmbiguous('Back to board', 'Back to floor summary')).toBe(false);
    });

    it('does not accuse a label of being ambiguous with itself', () => {
        expect(labelsAreAmbiguous('Continue', 'Continue')).toBe(false);
    });

    it('folds the other gesture families a player reads as one instruction', () => {
        expect(labelsAreAmbiguous('Continue', 'Proceed')).toBe(true);
        expect(labelsAreAmbiguous('Close', 'Dismiss')).toBe(true);
        expect(labelsAreAmbiguous('Play again', 'Retry again')).toBe(false);
        expect(labelsAreAmbiguous('Restart run', 'Retry run')).toBe(true);
    });

    it('ignores punctuation and spacing, which are not what a player reads', () => {
        expect(labelsAreAmbiguous('Back  to board!', 'Return to board')).toBe(true);
    });

    it('keeps two genuinely different actions apart', () => {
        expect(labelsAreAmbiguous('Visit shop', 'Main menu')).toBe(false);
        expect(labelsAreAmbiguous('Continue to Greedy route floor', 'Continue to Mystery route floor')).toBe(false);
    });
});

describe('normalizeControlLabel', () => {
    it('reduces a label to the instruction it gives', () => {
        expect(normalizeControlLabel('Return to board')).toBe('back to board');
        expect(normalizeControlLabel('Proceed')).toBe('go');
    });
});
