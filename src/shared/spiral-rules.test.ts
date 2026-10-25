import { describe, expect, it } from 'vitest';
import { type BoardState, type RunState, type Tile } from './contracts';
import { buildBoard } from './board-generation';
import { boardRings } from './cartographer-rules';
import { finalizeLevel } from './floor-clear-transition';
import { parTurnsForRun } from './floor-par';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { applySpiralTurn, sealSpiralRings, SPIRAL_RULES_FROM } from './spiral-rules';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

const spiralBoard = (seed = 7777): BoardState => {
    const entry = pickFloorScheduleEntry(seed, CLASSIC_DESCENT_RULES, 44, 'endless');
    return buildBoard(44, { runSeed: seed, runRulesVersion: CLASSIC_DESCENT_RULES, gameMode: 'endless', activeMutators: entry.mutators, floorArchetypeId: entry.floorArchetypeId, floorTag: entry.floorTag });
};

const spiralRun = (board: BoardState = spiralBoard(), extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
    return { ...base, status: 'playing', runRulesVersion: CLASSIC_DESCENT_RULES, board: { ...board, flippedTileIds: [] }, turnsThisFloor: 0, ...extra };
};

/** The board with these cells cleared. */
const cleared = (board: BoardState, cells: readonly number[]): BoardState => {
    const tiles = board.tiles.map((tile, index): Tile => (cells.includes(index) ? { ...tile, state: 'matched' } : tile));
    const gone = new Set(tiles.filter((tile) => tile.state === 'matched').map((tile) => tile.pairKey));
    const whole = [...gone].filter((key) => tiles.every((tile) => tile.pairKey !== key || tile.state === 'matched')).length;
    return { ...board, tiles, matchedPairs: whole };
};

describe('the Spiral (DGE-021)', () => {
    it('takes a Wanderer’s footprint with the floor when it is survived at par (the soak, 2026-10-25)', () => {
        const before = spiralRun();
        const par = parTurnsForRun(before);
        const board = { ...before.board!, tiles: before.board!.tiles.map((tile, index) => (index === 0 ? { ...tile, footprint: true } : tile)) };
        const after = { ...before, board, turnsThisFloor: par };
        const survived = applySpiralTurn({ ...before, turnsThisFloor: par - 1 }, after, (run) => run);
        expect(survived.spiralSurvived).toBe(true);
        expect(survived.board!.tiles.some((tile) => tile.footprint)).toBe(false);
    });

    it('stands on floors 44 and 56 from rules 85', () => {
        expect(pickFloorScheduleEntry(7777, CLASSIC_DESCENT_RULES, 44, 'endless').floorArchetypeId).toBe('spiral_hall');
        expect(pickFloorScheduleEntry(7777, CLASSIC_DESCENT_RULES, 56, 'endless').floorArchetypeId).toBe('spiral_hall');
        expect(pickFloorScheduleEntry(7777, SPIRAL_RULES_FROM - 1, 44, 'endless').floorArchetypeId).not.toBe('spiral_hall');
        expect(['cursed_last', 'flip_par']).not.toContain(pickFloorScheduleEntry(7777, CLASSIC_DESCENT_RULES, 44, 'endless').featuredObjectiveId);
    });

    it('a cleared outer ring seals, and fresh pairs are dealt into the cleared cells inside it', () => {
        const board = spiralBoard();
        const [outer, ...inner] = boardRings(board.columns, board.rows, board.tiles.length);
        const insideSet = new Set(inner.flat());
        // Two whole pairs inside, and every pair with a card in the outer ring.
        const insidePairs = [...new Set(board.tiles.filter((_, i) => insideSet.has(i)).map((tile) => tile.pairKey))].filter((key) =>
            board.tiles.every((tile, i) => tile.pairKey !== key || insideSet.has(i))
        ).slice(0, 2);
        const outerPairs = new Set(outer!.map((cell) => board.tiles[cell]!.pairKey));
        const clearedCells = board.tiles.flatMap((tile, i) => (outerPairs.has(tile.pairKey) || insidePairs.includes(tile.pairKey) ? [i] : []));
        const sealed = sealSpiralRings(cleared(board, clearedCells), { seed: 'x' });
        expect(sealed.sealed).toBe(1);
        expect(sealed.board.spiralRingsSealed).toBe(1);
        expect(outer!.every((cell) => sealed.board.tiles[cell]!.sealed && sealed.board.tiles[cell]!.state === 'removed')).toBe(true);
        // The whole cleared pairs are gathered inside and dealt again: at least the ones that started there.
        expect(sealed.dealtPairs).toBeGreaterThanOrEqual(insidePairs.length);
        expect(sealed.dealtPairs).toBeGreaterThan(0);
        const goneAfter = new Set(sealed.board.tiles.filter((tile) => tile.state !== 'hidden').map((tile) => tile.pairKey));
        const wholeGone = [...goneAfter].filter((key) => sealed.board.tiles.every((tile) => tile.pairKey !== key || tile.state !== 'hidden')).length;
        expect(sealed.board.matchedPairs).toBe(wholeGone);
        // Every pair on the board is still two cards.
        const counts = new Map<string, number>();
        for (const tile of sealed.board.tiles) counts.set(tile.pairKey, (counts.get(tile.pairKey) ?? 0) + 1);
        expect([...counts.values()].every((n) => n === 2)).toBe(true);
    });

    it('an empty board before par seals one ring and deals the rest again; the floor goes on', () => {
        const board = spiralBoard();
        const empty = cleared(board, board.tiles.map((_, index) => index));
        const next = finalizeLevel(spiralRun(empty, { turnsThisFloor: 3 }), empty);
        expect(next.status).toBe('playing');
        expect(next.board!.spiralRingsSealed).toBe(1);
        expect(next.board!.tiles.some((tile) => tile.state === 'hidden')).toBe(true);
    });

    it('the floor is survived at par, whatever is left, and the Hold lets go', () => {
        const run = spiralRun();
        const par = parTurnsForRun(run);
        const atPar = applySpiralTurn({ ...run, turnsThisFloor: par - 1 }, { ...run, turnsThisFloor: par, holding: true, heldSeedIds: [] }, (survived) => finalizeLevel(survived, survived.board!));
        expect(atPar.status).toBe('levelComplete');
        expect(atPar.spiralSurvived).toBe(true);
        expect(atPar.holding).toBe(false);
        const before = applySpiralTurn({ ...run, turnsThisFloor: par - 2 }, { ...run, turnsThisFloor: par - 1 }, (survived) => finalizeLevel(survived, survived.board!));
        expect(before.status).toBe('playing');
    });

    it('a Spiral played through the real turns always ends, by par', () => {
        for (const seed of Array.from({ length: 30 }, (_, i) => i + 1).concat(7777)) playsToTheEnd(spiralRun(spiralBoard(seed), { runSeed: seed }));
    });

    // A turn that empties the board ends the Spiral by its last ring at some seeds: survived all the same (2026-10-24).
    const playsToTheEnd = (start: RunState): void => {
        let run = start;
        const par = parTurnsForRun(run);
        for (let step = 0; step < 400 && run.status === 'playing'; step += 1) {
            // A turn left open (a trait refused its second card) is finished with the open card's twin.
            const open = run.board!.flippedTileIds[0];
            const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden');
            let next: RunState | null = null;
            const firsts = open ? [run.board!.tiles.find((tile) => tile.id === open)!] : hidden;
            for (const first of firsts) {
                const second = hidden.find((tile) => tile.id !== first.id && tile.pairKey === first.pairKey);
                if (!second) continue;
                const flipped = open ? flipTile(run, second.id) : flipTile(flipTile(run, first.id), second.id);
                if (flipped.board!.flippedTileIds.length === 2) {
                    next = resolveBoardTurn(flipped);
                    break;
                }
            }
            if (!next) break;
            run = next;
        }
        expect(run.status, String(run.runSeed)).toBe('levelComplete');
        expect(run.turnsThisFloor).toBeLessThanOrEqual(par);
        expect(run.spiralSurvived, String(run.runSeed)).toBe(true);
    };
});
