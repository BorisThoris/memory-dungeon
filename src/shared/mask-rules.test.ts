import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard } from './board-generation';
import { createNewRun, finishMemorizePhase, flipTile } from './game';
import { dealMasks, MASK_FROM_FLOOR, MASK_RULES_FROM, masksForFloor, unmaskBoard } from './mask-rules';
import { playerVisibleBoard } from './player-visible-board';

const deepBoard = (level = MASK_FROM_FLOOR, seed = 7777) =>
    buildBoard(level, { runSeed: seed, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] });

describe('Masks (DGE-016)', () => {
    it('masks a few cards a floor from the Deep, one card of a pair, with an element that is not its own', () => {
        expect(masksForFloor(MASK_FROM_FLOOR - 1)).toBe(0);
        expect(masksForFloor(MASK_FROM_FLOOR)).toBe(2);
        expect(masksForFloor(40)).toBe(3);
        for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
            const board = dealMasks(deepBoard(MASK_FROM_FLOOR, seed), { runSeed: seed, rulesVersion: GAME_RULES_VERSION });
            const masked = board.tiles.filter((tile) => tile.mask != null);
            expect(masked).toHaveLength(2);
            for (const tile of masked) {
                expect(tile.mask).not.toBe(tile.suit);
                // A pair keeps one honest back.
                expect(board.tiles.filter((other) => other.pairKey === tile.pairKey && other.mask != null)).toHaveLength(1);
            }
        }
        expect(dealMasks(deepBoard(), { runSeed: 1, rulesVersion: MASK_RULES_FROM - 1 }).tiles.some((tile) => tile.mask)).toBe(false);
    });

    it('the screen is shown the mask; the rules keep the true element', () => {
        const board = dealMasks(deepBoard(), { runSeed: 7777, rulesVersion: GAME_RULES_VERSION });
        const masked = board.tiles.find((tile) => tile.mask != null)!;
        const shown = playerVisibleBoard(board).tiles.find((tile) => tile.id === masked.id)!;
        expect(shown.suit).toBe(masked.mask);
        expect(shown.mask).toBeUndefined();
        expect(masked.suit).not.toBe(masked.mask);
    });

    it('the first flip drops the mask for the rest of the floor', () => {
        const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
        const board = dealMasks(deepBoard(), { runSeed: 7777, rulesVersion: GAME_RULES_VERSION });
        const masked = board.tiles.find((tile) => tile.mask != null)!;
        const run = { ...base, status: 'playing' as const, runRulesVersion: GAME_RULES_VERSION, board: { ...board, flippedTileIds: [] } };
        const flipped = flipTile(run, masked.id);
        const after = flipped.board!.tiles.find((tile) => tile.id === masked.id)!;
        expect(after.mask).toBeUndefined();
        expect(after.suit).toBe(masked.suit);
        expect(flipped.masksDroppedThisFloor).toBe(1);
    });

    it('the Unmasking Glass drops every mask', () => {
        const board = dealMasks(deepBoard(), { runSeed: 7777, rulesVersion: GAME_RULES_VERSION });
        expect(unmaskBoard(board).tiles.some((tile) => tile.mask != null)).toBe(false);
    });
});
