import { describe, expect, it } from 'vitest';
import { wardenEndLine } from './gameOverScreen';

describe('the Warden line on the results screen (DGE-023)', () => {
    it('names how the complete Warden fell', () => {
        expect(wardenEndLine({ highestLevel: 60, runEndReason: 'warden_cleared' }, { wardenFelled: true })).toBe('Felled by a Hold released at 12 pairs or more.');
        expect(wardenEndLine({ highestLevel: 60, runEndReason: 'warden_cleared' }, { wardenFelled: false })).toBeNull();
    });

    it('shows the distance and the condition for a death within three floors', () => {
        expect(wardenEndLine({ highestLevel: 58, runEndReason: 'miss_budget' }, {})).toMatch(/^2 floors short of the Warden\. .*12 pairs\.$/);
        expect(wardenEndLine({ highestLevel: 59, runEndReason: 'miss_budget' }, {})).toMatch(/^1 floor short/);
        expect(wardenEndLine({ highestLevel: 60, runEndReason: 'miss_budget' }, {})).toMatch(/^The Warden stood\./);
        expect(wardenEndLine({ highestLevel: 57, runEndReason: 'miss_budget' }, {})).toBeNull();
        expect(wardenEndLine({ highestLevel: 61, runEndReason: 'miss_budget' }, { endless: true })).toBeNull();
    });
});
