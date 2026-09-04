import { describe, expect, it } from 'vitest';
import type { RunSummary } from './contracts';
import { createDefaultSaveData } from './save-data';
import { personalBestResult } from './personal-best';

const summaryOf = (totalScore: number, over: Partial<RunSummary> = {}): RunSummary =>
    ({
        achievementsEnabled: true,
        bestScore: Math.max(totalScore, 0),
        bestStreak: 0,
        highestLevel: 3,
        levelsCleared: 3,
        perfectClears: 0,
        totalScore,
        unlockedAchievements: [],
        ...over
    }) as RunSummary;

const saveWithBest = (bestScore: number) => ({ ...createDefaultSaveData(), bestScore });

describe('personalBestResult', () => {
    it('calls a run that beat the old record a personal best', () => {
        expect(
            personalBestResult({ achievementsEnabled: true, saveAtRunStart: saveWithBest(900), summary: summaryOf(1200) })
        ).toBe('beaten');
    });

    it('compares against the record as it stood when the run started, not after', () => {
        // The save has already taken the new score by the time Game Over renders, so comparing to
        // `summary.bestScore` would call every run a personal best.
        const summary = summaryOf(1200, { bestScore: 1200 });
        expect(
            personalBestResult({ achievementsEnabled: true, saveAtRunStart: saveWithBest(1200), summary })
        ).toBe('matched');
    });

    it('says nothing about a run that fell short', () => {
        expect(
            personalBestResult({ achievementsEnabled: true, saveAtRunStart: saveWithBest(900), summary: summaryOf(400) })
        ).toBeNull();
    });

    it('does not congratulate a first run for equalling a record of zero', () => {
        expect(
            personalBestResult({ achievementsEnabled: true, saveAtRunStart: saveWithBest(0), summary: summaryOf(0) })
        ).toBeNull();
    });

    it('stays quiet on a practice run, which is explicitly not ranked', () => {
        expect(
            personalBestResult({ achievementsEnabled: false, saveAtRunStart: saveWithBest(100), summary: summaryOf(9000) })
        ).toBeNull();
    });

    it('stays quiet when there is no record of how the run started', () => {
        expect(
            personalBestResult({ achievementsEnabled: true, saveAtRunStart: null, summary: summaryOf(9000) })
        ).toBeNull();
    });
});
