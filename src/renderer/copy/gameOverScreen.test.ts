import { describe, expect, it } from 'vitest';
import { achievementsNote, gameOverScreenCopy, runEndReasonLine } from './gameOverScreen';

describe('the end-reason line', () => {
    it('names the rule that ended the run, never the player', () => {
        expect(runEndReasonLine({ highestLevel: 7, runEndReason: 'turn_ceiling' })).toBe(
            'The turn ceiling ran out on floor 7.'
        );
        expect(runEndReasonLine({ highestLevel: 7, runEndReason: 'quit' })).toBe('You stopped on floor 7.');
        expect(runEndReasonLine({ highestLevel: 3, runEndReason: 'contract' })).toBe(
            "The contract's mismatch limit ended the run on floor 3."
        );
        expect(runEndReasonLine({ highestLevel: 5, runEndReason: 'pass_and_play_final_floor' })).toBe(
            'The table played its last floor, floor 5.'
        );
        for (const line of Object.values(gameOverScreenCopy.endReason).map((make) => make(7))) {
            expect(line).not.toMatch(/\b(life|lives|lost|penalty|punish|fail|failed)\b/i);
        }
    });

    it('says nothing for a summary that predates the reason', () => {
        expect(runEndReasonLine({ highestLevel: 7 })).toBeNull();
    });
});

describe('achievementsNote', () => {
    it('says they counted when they did', () => {
        expect(achievementsNote({ achievementsEnabled: true })).toBe(gameOverScreenCopy.achievementsNoteOn);
    });

    it('does not accuse a shared game of using debug tools', () => {
        // There were three ways to turn achievements off and one line explaining them, which
        // told a table that had never opened a debug tool that they had.
        const note = achievementsNote({ achievementsEnabled: false, sharedTable: true });
        expect(note).toBe(gameOverScreenCopy.achievementsNoteOffShared);
        expect(note).not.toMatch(/debug/iu);
    });

    it('does not accuse a practice run either', () => {
        const note = achievementsNote({ achievementsEnabled: false, practiceMode: true });
        expect(note).toBe(gameOverScreenCopy.achievementsNoteOffPractice);
        expect(note).not.toMatch(/debug/iu);
    });

    it('still says debug tools when that really is the reason', () => {
        expect(achievementsNote({ achievementsEnabled: false })).toBe(gameOverScreenCopy.achievementsNoteOff);
    });

    it('leads with the shared game, which is the promise the mode already made', () => {
        expect(
            achievementsNote({ achievementsEnabled: false, practiceMode: true, sharedTable: true })
        ).toBe(gameOverScreenCopy.achievementsNoteOffShared);
    });
});
