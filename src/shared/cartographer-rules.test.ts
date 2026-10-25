import { describe, expect, it } from 'vitest';
import { type BoardState, type RunState, type Tile } from './contracts';
import { buildBoard } from './board-generation';
import { dealLayers } from './board-layers-rules';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { createNewRun, finishMemorizePhase } from './game';
import { applyCartographerTurn, boardRings, CARTOGRAPHER_RULES_FROM, rotateLowerLayer } from './cartographer-rules';
import { playerVisibleBoard } from './player-visible-board';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

const cartographerBoard = (seed = 7777): BoardState => {
    const entry = pickFloorScheduleEntry(seed, CLASSIC_DESCENT_RULES, 40, 'endless');
    const built = buildBoard(40, { runSeed: seed, runRulesVersion: CLASSIC_DESCENT_RULES, gameMode: 'endless', activeMutators: entry.mutators, floorArchetypeId: entry.floorArchetypeId, floorTag: entry.floorTag });
    return dealLayers(built, { runSeed: seed, rulesVersion: CLASSIC_DESCENT_RULES });
};

/** A board of `columns` x `rows` with a card under every cell, named by its cell. */
const grid = (columns: number, rows: number): BoardState => {
    const template = cartographerBoard().tiles[0]!;
    const tiles = Array.from({ length: columns * rows }, (_, index): Tile => ({ ...template, id: `top-${index}`, pairKey: `top-${index}` }));
    const beneath = Array.from({ length: columns * rows }, (_, index): Tile => ({ ...template, id: `under-${index}`, pairKey: `under-${index}` }));
    return { ...cartographerBoard(), tiles, beneath, columns, rows };
};

describe('the Cartographer (DGE-018)', () => {
    it('is the Deep’s boss from rules 82, and its floor is dealt two decks deep', () => {
        expect(pickFloorScheduleEntry(7777, CLASSIC_DESCENT_RULES, 40, 'endless').floorArchetypeId).toBe('cartographer_hall');
        expect(pickFloorScheduleEntry(7777, CARTOGRAPHER_RULES_FROM - 1, 40, 'endless').floorArchetypeId).not.toBe('cartographer_hall');
        expect((cartographerBoard().beneath ?? []).some(Boolean)).toBe(true);
    });

    it('turns a square board’s lower deck exactly a quarter, clockwise', () => {
        const board = grid(3, 3);
        const turned = rotateLowerLayer(board, []);
        // The top-left corner goes to the top-right, the top-right to the bottom-right.
        expect(turned.beneath![2]!.id).toBe('under-0');
        expect(turned.beneath![8]!.id).toBe('under-2');
        expect(turned.beneath![4]!.id).toBe('under-4');
        // Four turns are the board it started as.
        let back = turned;
        for (let i = 0; i < 3; i += 1) back = rotateLowerLayer(back, []);
        expect(back.beneath!.map((card) => card?.id)).toEqual(board.beneath!.map((card) => card?.id));
    });

    it('turns any other shape with wrap, every card kept once, the top deck untouched', () => {
        for (const [columns, rows] of [[5, 3], [4, 7], [6, 1], [7, 4]] as const) {
            const board = grid(columns, rows);
            const turned = rotateLowerLayer(board, []);
            expect([...turned.beneath!.map((card) => card!.id)].sort()).toEqual([...board.beneath!.map((card) => card!.id)].sort());
            expect(turned.tiles.map((tile) => tile.id)).toEqual(board.tiles.map((tile) => tile.id));
            expect(boardRings(columns, rows, columns * rows).flat().sort((a, b) => a - b)).toEqual(Array.from({ length: columns * rows }, (_, i) => i));
        }
    });

    it('a pinned card keeps what lies under it', () => {
        const board = grid(4, 3);
        const turned = rotateLowerLayer(board, ['top-0']);
        expect(turned.beneath![0]!.id).toBe('under-0');
        expect([...turned.beneath!.map((card) => card!.id)].sort()).toEqual([...board.beneath!.map((card) => card!.id)].sort());
    });

    it('turns on every third match of the floor, and the study window charts the deck beneath', () => {
        const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
        const board = cartographerBoard();
        const run: RunState = { ...base, status: 'playing', runRulesVersion: CLASSIC_DESCENT_RULES, board, matchResolutionsThisFloor: 2 };
        expect(applyCartographerTurn(run, { ...run, matchResolutionsThisFloor: 3 }).cartographerTurnsThisFloor).toBe(1);
        expect(applyCartographerTurn(run, { ...run }).cartographerTurnsThisFloor ?? 0).toBe(0);
        const waiting = board.beneath!.find(Boolean)!;
        const charted = playerVisibleBoard(board, { chartBeneath: true }).beneath!.find((card) => card?.id === waiting.id)!;
        expect(charted.suit).toBe(waiting.suit);
        expect(charted.pairKey).toBe('');
        expect(playerVisibleBoard(board).beneath!.find((card) => card?.id === waiting.id)!.suit).toBeUndefined();
    });
});
