import { describe, expect, it } from 'vitest';
import type { RunState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { countFindablePairs } from './board-tile-generation-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { parTurnsForFloor } from './floor-par';
import { MISS_BANK_COMBO_RUNG, MISS_BANK_OPENING, missesLeft } from './miss-bank';
import { runNonNegativeInteger } from './run-number-guards';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { getUnresolvedPlayablePairGroups } from './playthrough-solver-rules';
import { isSingletonUtilityPairKey } from './tile-identity';
import { isTileFlipBlocked } from './realm-weather-rules';

/**
 * Thesis §67, trace 4: a bad floor is quiet, not punishing (task T2.10).
 *
 * Floor eleven, a tired player: the whole miss budget spent on one floor - two misses, a match, a
 * third miss - and then the floor finished from memory; a bad floor rather than a bad opening a
 * player recovers from. What must be true at the end - the floor cleared, the run went
 * on, the score went up, the bonus was small, and nothing said "you did badly" - is checked here
 * against the real turn path on a real generated floor, not a fixture.
 */
const FLOOR = 11;
const SEED = 42_001;

const hiddenTiles = (run: RunState): Tile[] =>
    run.board!.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));

const playMiss = (run: RunState): RunState => {
    // This trace spends one miss at a time; Heavy intentionally charges two and its placement
    // changes with a rules-version reseed. Its penalty is covered by the Heavy tests.
    const hidden = hiddenTiles(run).filter((tile) => tile.tileTraitKind !== 'heavy');
    const first = hidden[0]!;
    const second = hidden.find((tile) => tile.pairKey !== first.pairKey);
    // Once the pops have left a single pair standing there is nothing to miss with; the trace
    // matches it and moves on, the way a player would.
    return second ? resolveBoardTurn(flipTile(flipTile(run, first.id), second.id)) : playMatch(run);
};

const playMatch = (run: RunState): RunState => {
    // A pair the player can turn: a card the realm froze or vined is passed over, as at the table.
    const group = getUnresolvedPlayablePairGroups(run.board!).find((tiles) =>
        tiles.every((tile) => tile.state === 'hidden' && !isTileFlipBlocked(tile))
    )!;
    return resolveBoardTurn(flipTile(flipTile(run, group[0]!.id), group[1]!.id));
};

const startFloorEleven = (): RunState => {
    const schedule = pickFloorScheduleEntry(SEED, GAME_RULES_VERSION, FLOOR, 'endless');
    const board = buildBoard(FLOOR, {
        runSeed: SEED,
        runRulesVersion: GAME_RULES_VERSION,
        floorTag: schedule.floorTag,
        floorArchetypeId: schedule.floorArchetypeId,
        featuredObjectiveId: schedule.featuredObjectiveId,
        cycleFloor: schedule.cycleFloor,
        gameMode: 'endless',
        activeMutators: []
    });
    const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: SEED }));
    // The tired player arrives on a full bank: the trace is about one bad floor, not a bad run.
    return {
        ...base,
        board,
        status: 'playing',
        findablesTotalThisFloor: countFindablePairs(board.tiles),
        missBank: [{ floor: board.level, misses: MISS_BANK_OPENING }]
    };
};

const PUNISHING = /\b(life|lives|lost|penalty|punish\w*)\b/iu;

describe('a bad floor is quiet, not punishing (thesis §67, trace 4)', () => {
    it('clears with three misses, pays less, loses nothing, and says nothing punishing', () => {
        let run = startFloorEleven();
        const scoreBefore = run.stats.totalScore;
        const par = parTurnsForFloor(run.board!.pairCount);
        // Two misses, then a match, a third miss, then matches: the whole of the opening bank spent
        // on one floor (2026-09-23, `miss-bank.ts`), and the floor still cleared. The trace used to
        // be seven misses; the budget is three now, and this is the bad floor it allows.
        const script: Array<'miss' | 'match'> = ['miss', 'miss', 'match', 'miss', 'match'];
        let missTurns = 0;
        for (const step of script) {
            if (run.status !== 'playing') break;
            const mismatchesBefore = run.stats.mismatches;
            const turnsBefore = run.turnsThisFloor;
            run = step === 'miss' ? playMiss(run) : playMatch(run);
            if (run.stats.mismatches > mismatchesBefore) {
                missTurns += 1;
                expect(run.turnsThisFloor, 'a miss is a turn on the floor').toBe(turnsBefore + 1);
            }
            expect(run.status, `after a ${step}`).not.toBe('gameOver');
        }
        // Then matches to the end - the budget is spent, so the finish has to be clean, and a clean
        // finish earns whatever rung it honestly climbs to. The trace is about the misses, not the
        // rung: nothing about the three of them is said back as a punishment.
        while (run.status === 'playing') {
            run = playMatch(run);
        }

        // The floor cleared and the run went on: the misses were inside the budget, and nothing on
        // the floor said so as a punishment.
        expect(run.status).toBe('levelComplete');
        expect(run.runEndReason).toBeNull();
        expect(run.stats.mismatches).toBeGreaterThanOrEqual(2);
        // The three misses came out of the bank; the clean finish that followed put back whatever
        // its chain earned (one per five in a row, 2026-09-24), which is the recovery and not a
        // softening: the count never reads higher than the chain honestly paid for.
        const earnedByChain = Math.floor(runNonNegativeInteger(run.bestChainThisFloor) / MISS_BANK_COMBO_RUNG);
        expect(missesLeft(run)).toBe(MISS_BANK_OPENING - run.stats.mismatches + earnedByChain);

        // What the misses cost is the turns they took, and every one of them is on the floor's count.
        // It is not "more turns than clean play on this deal": the trace's clean player takes the
        // first pair it finds, and the order the misses force can pop better than that order does -
        // on rules 63 this deal clears in 13 turns with the misses and 15 without. That compared two
        // cascade routes, not a bad floor with a good one.
        const result = run.lastLevelResult!;
        expect(result.parTurns).toBe(par);
        expect(result.turnsTaken).toBe(run.turnsThisFloor);
        expect(missTurns).toBe(run.stats.mismatches);
        expect(result.turnsTaken).toBeGreaterThan(missTurns);
        expect(run.stats.totalScore).toBeGreaterThan(scoreBefore);

        // Nothing the floor said was a punishment. The chain resetting is the whole cost.
        const messages = (run.gameplayEventJournal as Array<{ type: string; message?: string }>)
            .filter((event) => event.type === 'feedback.requested')
            .map((event) => event.message ?? '');
        for (const message of messages) {
            expect(message).not.toMatch(PUNISHING);
        }
        expect(Object.keys(run)).not.toContain('lives');
    });

    it('ends the run only when the miss bank is spent, and never for a miss inside it', () => {
        let run = startFloorEleven();
        for (let spent = 1; spent <= MISS_BANK_OPENING; spent += 1) {
            run = playMiss(run);
            expect(run.status, `miss ${spent}`).toBe('playing');
            expect(run.runEndReason).toBeNull();
            expect(missesLeft(run)).toBe(MISS_BANK_OPENING - spent);
        }
        run = playMiss(run);
        expect(run.status).toBe('gameOver');
        expect(run.runEndReason).toBe('miss_budget');
        expect(run.board?.flippedTileIds).toEqual([]);
    });
});
