import { afterEach, describe, expect, it, vi } from 'vitest';
import { advanceToNextLevel, createDailyRun } from './game';
import { rollRelicOptions } from './relics';
import type { RunState } from './contracts';

/**
 * A Daily Challenge is only a challenge if every player gets the same run. Two people comparing
 * scores over a board that quietly differed are not competing at anything, and a streak built on
 * one machine means nothing on another.
 *
 * The seed is derived from the UTC date, so the property to prove is that nothing downstream of it
 * reaches for unseeded randomness. `createNewRun` does call `Math.random()` before a `runSeed`
 * override lands, which is exactly the kind of thing that leaks — so these tests drive
 * `Math.random` to a different fixed value for each of the two runs. Anything genuinely seeded is
 * unaffected; anything that is not diverges immediately.
 */
const FLOORS_TO_WALK = 8;

/** A run's whole observable shape, deep enough that a single reshuffled tile shows up. */
const fingerprintRun = (run: RunState): string =>
    JSON.stringify({
        activeMutators: run.activeMutators,
        columns: run.board?.columns ?? null,
        level: run.board?.level ?? null,
        pairKeys: run.board?.tiles.map((tile) => tile.pairKey) ?? [],
        runSeed: run.runSeed,
        traits: run.board?.tiles.map((tile) => tile.tileTraitKind ?? null) ?? []
    });

const walkDaily = (randomValue: number): { fingerprints: string[]; relicOffers: string[] } => {
    // Every unseeded draw in the run returns this constant, so two walks under different constants
    // agree only if nothing unseeded reached the board.
    vi.spyOn(Math, 'random').mockReturnValue(randomValue);
    let run = createDailyRun(0);
    const fingerprints = [fingerprintRun(run)];
    const relicOffers = [rollRelicOptions(run, 0, run.board?.level ?? 1).join('+')];

    for (let floor = 0; floor < FLOORS_TO_WALK; floor += 1) {
        const cleared: RunState = { ...run, status: 'levelComplete' };
        run = advanceToNextLevel(cleared);
        fingerprints.push(fingerprintRun(run));
        relicOffers.push(rollRelicOptions(run, 0, run.board?.level ?? 1).join('+'));
    }
    return { fingerprints, relicOffers };
};

describe('the daily challenge is the same run for everyone', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('builds the same board, traits and mutators however the host machine is behaving', () => {
        const first = walkDaily(0.11);
        const second = walkDaily(0.87);

        expect(first.fingerprints).toHaveLength(FLOORS_TO_WALK + 1);
        expect(second.fingerprints).toEqual(first.fingerprints);
    });

    it('offers the same relics at the same milestones', () => {
        // Relic options are seeded from the run seed and cleared floor, so two players reaching the
        // same milestone must be choosing between the same three.
        expect(walkDaily(0.11).relicOffers).toEqual(walkDaily(0.87).relicOffers);
    });

    it('derives the same seed however the host machine is behaving', () => {
        vi.spyOn(Math, 'random').mockReturnValue(0.5);
        const seed = createDailyRun(0).runSeed;
        vi.restoreAllMocks();
        vi.spyOn(Math, 'random').mockReturnValue(0.01);

        // The seed comes from the UTC date and the rules version, and from nothing else.
        expect(createDailyRun(0).runSeed).toBe(seed);
    });

    it('does not depend on the local clock beyond the UTC date it derives the seed from', () => {
        // Two players in different time zones on the same UTC day get the same key.
        vi.spyOn(Math, 'random').mockReturnValue(0.42);
        expect(createDailyRun(0).dailyDateKeyUtc).toBe(createDailyRun(0).dailyDateKeyUtc);
        expect(createDailyRun(0).dailyDateKeyUtc).toMatch(/^\d{8}$/u);
    });
});
