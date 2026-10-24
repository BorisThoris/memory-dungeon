import { VERB_LEGACY_FIRST_FLOORS } from './verb-staircase-rules';
import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RepriseTurn, type RunState } from './contracts';
import { createNewRun, finishMemorizePhase } from './game';
import { applyMissBudget, missesLeft } from './miss-bank';
import { canReprise, reprise, REPRISE_FROM, recordRepriseTurn } from './reprise-rules';

const abyssRun = (repriseTurns: RepriseTurn[], extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
    return {
        ...base,
        status: 'playing',
        runRulesVersion: GAME_RULES_VERSION,
        board: { ...base.board!, level: VERB_LEGACY_FIRST_FLOORS.reprise, flippedTileIds: [] },
        missBank: [{ floor: VERB_LEGACY_FIRST_FLOORS.reprise, misses: 3 }],
        stats: { ...base.stats, totalScore: 1000, currentLevelScore: 100, currentStreak: 3 },
        repriseTurns,
        ...extra
    };
};

const MATCH = (score: number): RepriseTurn => ({ matched: true, score });
const MISS: RepriseTurn = { matched: false, score: 0 };

describe('Reprise (DGE-019)', () => {
    it('pays the last three turns again: every match its score and a link, and no turn', () => {
        const run = abyssRun([MISS, MATCH(40), MATCH(50), MATCH(60)]);
        expect(canReprise(run)).toBe(true);
        const repriseed = reprise(run, applyMissBudget);
        expect(repriseed.stats.totalScore).toBe(1000 + 150);
        expect(repriseed.stats.currentStreak).toBe(6);
        expect(repriseed.turnsThisFloor).toBe(run.turnsThisFloor);
        expect(repriseed.repriseUsedThisFloor).toBe(true);
        expect(canReprise(repriseed)).toBe(false);
    });

    it('a miss in them costs its miss again and breaks the chain, in order', () => {
        const run = abyssRun([MATCH(40), MISS, MATCH(60)]);
        const repriseed = reprise(run, applyMissBudget);
        expect(missesLeft(repriseed)).toBe((missesLeft(run) ?? 0) - 1);
        expect(repriseed.stats.totalScore).toBe(1000 + 100);
        // The chain: 3, +1 for the match, broken by the miss, +1 for the last match.
        expect(repriseed.stats.currentStreak).toBe(1);
    });

    it('needs three turns of the floor, from floor 41 and rules 83; the Echo Chamber replays five', () => {
        expect(canReprise(abyssRun([MATCH(10), MATCH(10)]))).toBe(false);
        expect(canReprise(abyssRun([MATCH(10), MATCH(10), MATCH(10)], { runRulesVersion: REPRISE_FROM - 1 }))).toBe(false);
        const chamber = abyssRun([MATCH(10), MATCH(10), MATCH(10), MATCH(10), MATCH(10)], { evolutions: ['echo_chamber'] });
        expect(reprise(chamber, applyMissBudget).stats.totalScore).toBe(1000 + 50);
        expect(canReprise(abyssRun([MATCH(10), MATCH(10), MATCH(10), MATCH(10)], { evolutions: ['echo_chamber'] }))).toBe(false);
    });

    it('remembers what each turn paid, the last five', () => {
        const before = abyssRun([], { turnsThisFloor: 2 });
        const matched = recordRepriseTurn(before, { ...before, turnsThisFloor: 3, stats: { ...before.stats, totalScore: 1075 } });
        expect(matched.repriseTurns).toEqual([{ matched: true, score: 75 }]);
        const missed = recordRepriseTurn(matched, { ...matched, turnsThisFloor: 4, stats: { ...matched.stats, mismatches: matched.stats.mismatches + 1 } });
        expect(missed.repriseTurns).toEqual([{ matched: true, score: 75 }, { matched: false, score: 0 }]);
        let long = missed;
        for (let i = 0; i < 6; i += 1) long = recordRepriseTurn(long, { ...long, turnsThisFloor: long.turnsThisFloor + 1 });
        expect(long.repriseTurns).toHaveLength(5);
    });
});
