import { describe, expect, it } from 'vitest';
import { type RunState } from './contracts';
import { buildBoard } from './board-generation';
import { foldBoard } from './board-fold-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { createNewRun, finishMemorizePhase } from './game';
import { applyKeeperTurn, KEEPER_RULES_FROM, keeperSwapCells, swapRooms } from './keeper-rules';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

const keeperBoard = (seed = 7777) => {
    const entry = pickFloorScheduleEntry(seed, CLASSIC_DESCENT_RULES, 24, 'endless');
    const built = buildBoard(24, { runSeed: seed, runRulesVersion: CLASSIC_DESCENT_RULES, gameMode: 'endless', activeMutators: entry.mutators, floorArchetypeId: entry.floorArchetypeId, floorTag: entry.floorTag });
    return foldBoard(built, { runSeed: seed, rulesVersion: CLASSIC_DESCENT_RULES });
};

describe('the Keeper of Halls (DGE-011)', () => {
    it('is the Living Dungeon’s boss from rules 81, and its floor is a Fold', () => {
        expect(pickFloorScheduleEntry(7777, CLASSIC_DESCENT_RULES, 24, 'endless').floorArchetypeId).toBe('keeper_hall');
        expect(pickFloorScheduleEntry(7777, KEEPER_RULES_FROM - 1, 24, 'endless').floorArchetypeId).not.toBe('keeper_hall');
        const board = keeperBoard();
        expect(board.floorArchetypeId).toBe('keeper_hall');
        expect(board.fold).toBeTruthy();
    });

    it('a swap keeps every pair and every card, and each card its place inside its room', () => {
        const board = keeperBoard();
        const swapped = swapRooms(board, []);
        expect([...swapped.tiles.map((tile) => tile.id)].sort()).toEqual([...board.tiles.map((tile) => tile.id)].sort());
        for (const [a, b] of keeperSwapCells(board)) {
            expect(swapped.tiles[a]!.id).toBe(board.tiles[b]!.id);
            expect(swapped.tiles[b]!.id).toBe(board.tiles[a]!.id);
        }
        // Twice is the board it started as.
        expect(swapRooms(swapped, []).tiles.map((tile) => tile.id)).toEqual(board.tiles.map((tile) => tile.id));
    });

    it('a pinned card holds its cell, and so does the card across from it', () => {
        const board = keeperBoard();
        const [a, b] = keeperSwapCells(board)[0]!;
        const pinned = board.tiles[a]!.id;
        const swapped = swapRooms(board, [pinned]);
        expect(swapped.tiles[a]!.id).toBe(pinned);
        expect(swapped.tiles[b]!.id).toBe(board.tiles[b]!.id);
    });

    it('swaps on the fourth resolved turn, and only then', () => {
        const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
        const run: RunState = { ...base, status: 'playing', runRulesVersion: CLASSIC_DESCENT_RULES, board: keeperBoard(), turnsThisFloor: 3 };
        const fourth = applyKeeperTurn(run, { ...run, turnsThisFloor: 4 });
        expect(fourth.keeperSwapsThisFloor).toBe(1);
        expect(fourth.board!.tiles.map((tile) => tile.id)).not.toEqual(run.board!.tiles.map((tile) => tile.id));
        expect(applyKeeperTurn(run, { ...run, turnsThisFloor: 3 }).keeperSwapsThisFloor ?? 0).toBe(0);
        const fifth = { ...run, turnsThisFloor: 4 };
        expect(applyKeeperTurn(fifth, { ...fifth, turnsThisFloor: 5 }).keeperSwapsThisFloor ?? 0).toBe(0);
    });
});
