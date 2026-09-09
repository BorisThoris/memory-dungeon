import { describe, expect, it } from 'vitest';
import type { RunState, Tile } from './contracts';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { countFindablePairs } from './board-tile-generation-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { parTurnsForFloor, turnCeilingForFloor } from './floor-par';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { getUnresolvedPlayablePairGroups } from './playthrough-solver-rules';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * Thesis §67, trace 4: a bad floor is quiet, not punishing (task T2.10).
 *
 * Floor eleven, a tired player: four misses, then matches, then three more misses, then the board
 * is small enough to remember and the rest goes cleanly. What must be true at the end - the floor
 * cleared, the run went on, the score went up, the bonus was small, and nothing said "you did
 * badly" - is checked here against the real turn path on a real generated floor, not a fixture.
 */
const FLOOR = 11;
const SEED = 42_001;

const hiddenTiles = (run: RunState): Tile[] =>
    run.board!.tiles.filter((tile) => tile.state === 'hidden' && !isSingletonUtilityPairKey(tile.pairKey));

const playMiss = (run: RunState): RunState => {
    const hidden = hiddenTiles(run);
    const first = hidden[0]!;
    const second = hidden.find((tile) => tile.pairKey !== first.pairKey);
    // Once the pops have left a single pair standing there is nothing to miss with; the trace
    // matches it and moves on, the way a player would.
    return second ? resolveBoardTurn(flipTile(flipTile(run, first.id), second.id)) : playMatch(run);
};

const playMatch = (run: RunState): RunState => {
    const group = getUnresolvedPlayablePairGroups(run.board!).find((tiles) =>
        tiles.every((tile) => tile.state === 'hidden')
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
    return { ...base, board, status: 'playing', findablesTotalThisFloor: countFindablePairs(board.tiles) };
};

const PUNISHING = /\b(life|lives|lost|penalty|punish\w*)\b/iu;

describe('a bad floor is quiet, not punishing (thesis §67, trace 4)', () => {
    it('clears with seven misses, pays less, loses nothing, and says nothing punishing', () => {
        let run = startFloorEleven();
        const scoreBefore = run.stats.totalScore;
        const par = parTurnsForFloor(run.board!.pairCount);
        const ceiling = turnCeilingForFloor(run.board!.pairCount);
        // Four misses, then matches; three more misses once something has been matched; then the
        // board is small enough to remember and the rest goes cleanly. Every match pops, so the
        // floor can end inside the script - what matters is that it ends cleared, never over.
        const script: Array<'miss' | 'match'> = ['miss', 'miss', 'miss', 'miss', 'match', 'miss', 'match', 'miss', 'match', 'miss'];
        for (const step of script) {
            if (run.status !== 'playing') break;
            run = step === 'miss' ? playMiss(run) : playMatch(run);
            expect(run.status, `after a ${step}`).not.toBe('gameOver');
        }
        while (run.status === 'playing') {
            run = playMatch(run);
        }

        // The floor cleared and the run went on: no life to lose, and the ceiling was never near.
        expect(run.status).toBe('levelComplete');
        expect(run.runEndReason).toBeNull();
        expect(run.stats.mismatches).toBeGreaterThanOrEqual(4);
        expect(run.turnsThisFloor).toBeLessThan(ceiling);

        // What the floor said at the end: over par, no efficiency, a tier at most Clean's, score up.
        const result = run.lastLevelResult!;
        expect(result.parTurns).toBe(par);
        expect(result.turnsTaken).toBe(run.turnsThisFloor);
        expect(result.turnsTaken).toBeGreaterThan(par);
        expect(result.floorEfficiencyBonus).toBeUndefined();
        expect(result.floorBonusTierMult ?? 1).toBeLessThanOrEqual(1.5);
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

    it('ends the run only when a floor is never cleared within three times its par, and never for a miss', () => {
        let run = startFloorEleven();
        const ceiling = turnCeilingForFloor(run.board!.pairCount);
        expect(ceiling).toBe(parTurnsForFloor(run.board!.pairCount) * 3);
        for (let turn = 1; turn < ceiling; turn += 1) {
            run = playMiss(run);
            expect(run.status, `turn ${turn}`).toBe('playing');
            expect(run.runEndReason).toBeNull();
        }
        run = playMiss(run);
        expect(run.status).toBe('gameOver');
        expect(run.runEndReason).toBe('turn_ceiling');
        expect(run.turnsThisFloor).toBe(ceiling);
        expect(run.board?.flippedTileIds).toEqual([]);
    });
});
