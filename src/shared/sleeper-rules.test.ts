import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type RunState } from './contracts';
import { buildBoard } from './board-generation';
import { createNewRun, finishMemorizePhase } from './game';
import { finalizeLevel } from './floor-clear-transition';
import { playerVisibleBoard } from './player-visible-board';
import { applySleeperTurn, dealSleepers, SLEEPER_FROM_FLOOR, SLEEPER_RULES_FROM, SLEEPER_WAKE_TURNS, sleepersForFloor, wakeSleeper } from './sleeper-rules';

const abyssBoard = (seed = 7777) => buildBoard(SLEEPER_FROM_FLOOR, { runSeed: seed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] });

const abyssRun = (extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
    const board = dealSleepers(abyssBoard(), { runSeed: 7777, rulesVersion: GAME_RULES_VERSION });
    return { ...base, status: 'playing', runRulesVersion: GAME_RULES_VERSION, board: { ...board, flippedTileIds: [] }, turnsThisFloor: 5, ...extra };
};

/** The run after a turn that matched the pair `pairKey`, at this chain. */
const matched = (run: RunState, pairKey: string, chain: number): RunState => ({
    ...run,
    turnsThisFloor: run.turnsThisFloor + 1,
    stats: { ...run.stats, currentStreak: chain },
    board: { ...run.board!, matchedPairs: run.board!.matchedPairs + 1, tiles: run.board!.tiles.map((tile) => (tile.pairKey === pairKey ? { ...tile, state: 'matched' as const } : tile)) }
});

describe('Sleepers (DGE-020)', () => {
    it('deals two Sleeper pairs a floor from 41, three from 51, and the screen never sees which', () => {
        expect(sleepersForFloor(SLEEPER_FROM_FLOOR - 1)).toBe(0);
        expect(sleepersForFloor(SLEEPER_FROM_FLOOR)).toBe(2);
        expect(sleepersForFloor(55)).toBe(3);
        const board = dealSleepers(abyssBoard(), { runSeed: 7777, rulesVersion: GAME_RULES_VERSION });
        expect(new Set(board.tiles.filter((tile) => tile.sleeper).map((tile) => tile.pairKey)).size).toBe(2);
        expect(playerVisibleBoard(board).tiles.some((tile) => tile.state === 'hidden' && tile.sleeper)).toBe(false);
        expect(dealSleepers(abyssBoard(), { runSeed: 7777, rulesVersion: SLEEPER_RULES_FROM - 1 }).tiles.some((tile) => tile.sleeper)).toBe(false);
    });

    it('a chain of three keeps a Sleeper down; less, and it sleeps', () => {
        const run = abyssRun();
        const pairKey = run.board!.tiles.find((tile) => tile.sleeper)!.pairKey;
        const held = applySleeperTurn(run, matched(run, pairKey, 3));
        expect(held.sleepingPairs ?? []).toEqual([]);
        expect(held.sleepersKeptDownThisFloor).toBe(1);
        const slept = applySleeperTurn(run, matched(run, pairKey, 2));
        expect(slept.sleepingPairs).toEqual([{ pairKey, wakeTurn: run.turnsThisFloor + 1 + SLEEPER_WAKE_TURNS }]);
    });

    it('wakes four turns later, face down, in two other cleared cells', () => {
        const run = abyssRun();
        const sleeperKey = run.board!.tiles.find((tile) => tile.sleeper)!.pairKey;
        const others = [...new Set(run.board!.tiles.filter((tile) => !tile.sleeper).map((tile) => tile.pairKey))].slice(0, 3);
        let current = applySleeperTurn(run, matched(run, sleeperKey, 1));
        const cellsBefore = current.board!.tiles.flatMap((tile, index) => (tile.pairKey === sleeperKey ? [index] : []));
        for (const key of others) current = applySleeperTurn(current, matched(current, key, 1));
        expect(current.sleepingPairs).toHaveLength(1);
        current = applySleeperTurn(current, { ...current, turnsThisFloor: current.turnsThisFloor + 1 });
        expect(current.sleepingPairs).toEqual([]);
        expect(current.sleepersWokenThisFloor).toBe(1);
        const cellsAfter = current.board!.tiles.flatMap((tile, index) => (tile.pairKey === sleeperKey ? [index] : []));
        expect(current.board!.tiles.filter((tile) => tile.pairKey === sleeperKey).every((tile) => tile.state === 'hidden')).toBe(true);
        expect(cellsAfter.some((cell) => cellsBefore.includes(cell))).toBe(false);
    });

    it('a held Sleeper wakes out of the Hold', () => {
        const run = abyssRun();
        const sleeperKey = run.board!.tiles.find((tile) => tile.sleeper)!.pairKey;
        const ids = run.board!.tiles.filter((tile) => tile.pairKey === sleeperKey).map((tile) => tile.id);
        let current = applySleeperTurn(run, { ...matched(run, sleeperKey, 1), holding: true, heldSeedIds: ids });
        for (let i = 0; i < 4; i += 1) current = applySleeperTurn(current, { ...current, turnsThisFloor: current.turnsThisFloor + 1 });
        expect(current.sleepersWokenThisFloor).toBe(1);
        expect(current.heldSeedIds).toEqual([]);
    });

    it('a board cleared with a Sleeper asleep wakes it, and the floor goes on', () => {
        const run = abyssRun();
        const sleeperKey = run.board!.tiles.find((tile) => tile.sleeper)!.pairKey;
        const cleared = { ...run.board!, matchedPairs: run.board!.pairCount, tiles: run.board!.tiles.map((tile) => ({ ...tile, state: 'matched' as const })) };
        const next = finalizeLevel({ ...run, board: cleared, sleepingPairs: [{ pairKey: sleeperKey, wakeTurn: 99 }] }, cleared);
        expect(next.status).toBe('playing');
        expect(next.board!.tiles.filter((tile) => tile.pairKey === sleeperKey).every((tile) => tile.state === 'hidden')).toBe(true);
        expect(wakeSleeper(cleared, sleeperKey, 'x').matchedPairs).toBe(cleared.matchedPairs - 1);
    });
});
