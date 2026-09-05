import { describe, expect, it } from 'vitest';
import { achievementsNote, gameOverScreenCopy } from './gameOverScreen';

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

    it('names the showcase when that is the reason', () => {
        expect(achievementsNote({ achievementsEnabled: false, dungeonShowcaseRun: true })).toBe(
            gameOverScreenCopy.achievementsNoteOffShowcase
        );
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
