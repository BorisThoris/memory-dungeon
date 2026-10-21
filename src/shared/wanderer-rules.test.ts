import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type RunState } from './contracts';
import { buildBoard } from './board-generation';
import { inspectBoardFairness } from './board-inspection';
import { createNewRun, finishMemorizePhase, flipTile, resolveBoardTurn } from './game';
import { playerVisibleTile } from './player-visible-board';
import {
    WANDERER_STEP_EVERY_TURNS,
    applyWandererSteps,
    dealWanderers,
    resolveWandererSteps,
    wandererFootprintCells,
    wandererPairsForFloor
} from './wanderer-rules';

const SEED = 4242;
const dealt = (level: number): BoardState =>
    dealWanderers(buildBoard(level, { runSeed: SEED, runRulesVersion: GAME_RULES_VERSION, gameMode: 'endless', activeMutators: [] }), {
        runSeed: SEED,
        rulesVersion: GAME_RULES_VERSION
    });
const wandererKeys = (board: BoardState): string[] => [...new Set(board.tiles.filter((tile) => tile.wanderer).map((tile) => tile.pairKey))];

/** A run between turns on a dealt board with a deep bank. */
const runOn = (board: BoardState, extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: SEED, realm: null }));
    return { ...base, status: 'playing', activeMutators: [], board, missBank: [{ floor: board.level, misses: 9 }], ...extra };
};

/** A miss on two plain cards of different pairs, neither a Wanderer, so only the clock moves. */
const plainMiss = (run: RunState): RunState => {
    const hidden = run.board!.tiles.filter((tile) => tile.state === 'hidden' && !tile.wanderer && !tile.pairKey.startsWith('__'));
    const first = hidden[0]!;
    const second = hidden.find((tile) => tile.pairKey !== first.pairKey)!;
    return resolveBoardTurn(flipTile(flipTile(run, first.id), second.id));
};

const cellOf = (board: BoardState, id: string): number => board.tiles.findIndex((tile) => tile.id === id);
const orthogonal = (a: number, b: number, columns: number): boolean =>
    (Math.abs(a - b) === columns) || (Math.abs(a - b) === 1 && Math.floor(a / columns) === Math.floor(b / columns));

describe('the Wanderers (DGE-009)', () => {
    it('are two pairs from the Living Dungeon, three from the Deep, none before', () => {
        expect(wandererPairsForFloor(12)).toBe(0);
        expect(wandererKeys(dealt(12))).toEqual([]);
        expect(wandererKeys(dealt(13))).toHaveLength(2);
        expect(wandererKeys(dealt(25))).toHaveLength(3);
        // Both halves of a Wanderer pair are Wanderers, and the deal is the seed's.
        for (const pairKey of wandererKeys(dealt(25))) {
            expect(dealt(25).tiles.filter((tile) => tile.pairKey === pairKey).every((tile) => tile.wanderer)).toBe(true);
        }
        expect(wandererKeys(dealt(25))).toEqual(wandererKeys(dealt(25)));
    });

    it('a run from an older rules version deals none', () => {
        const board = buildBoard(13, { runSeed: SEED, runRulesVersion: 69, gameMode: 'endless', activeMutators: [] });
        expect(wandererKeys(dealWanderers(board, { runSeed: SEED, rulesVersion: 69 }))).toEqual([]);
    });

    it('is a Wanderer on its face only', () => {
        const tile = dealt(13).tiles.find((candidate) => candidate.wanderer)!;
        expect(playerVisibleTile(tile).wanderer).toBeUndefined();
        expect(playerVisibleTile({ ...tile, state: 'flipped' }).wanderer).toBe(true);
    });

    it(`steps one cell on every ${WANDERER_STEP_EVERY_TURNS}rd turn and leaves a footprint for one turn`, () => {
        let run = runOn(dealt(13));
        const columns = run.board!.columns;
        const walkers = run.board!.tiles.filter((tile) => tile.wanderer).map((tile) => tile.id);
        const start = new Map(walkers.map((id) => [id, cellOf(run.board!, id)]));
        run = plainMiss(plainMiss(run));
        // Two turns: nobody has moved and there is no footprint.
        expect(walkers.every((id) => cellOf(run.board!, id) === start.get(id))).toBe(true);
        expect(wandererFootprintCells(run.board)).toEqual([]);
        run = plainMiss(run);
        const moved = walkers.filter((id) => cellOf(run.board!, id) !== start.get(id));
        expect(moved.length).toBeGreaterThan(0);
        for (const id of moved) {
            expect(orthogonal(cellOf(run.board!, id), start.get(id)!, columns)).toBe(true);
            expect(wandererFootprintCells(run.board)).toContain(start.get(id));
        }
        expect(run.wandererStepsThisFloor).toBe(wandererFootprintCells(run.board).length);
        // The footprint is on the card traded into the cell, face down, and the player can see it.
        expect(playerVisibleTile(run.board!.tiles[wandererFootprintCells(run.board)[0]!]!).footprint).toBe(1);
        expect(inspectBoardFairness(run.board!).issues ?? []).toEqual([]);
        // The next turn the footprints are gone.
        run = plainMiss(run);
        expect(wandererFootprintCells(run.board)).toEqual([]);
    });

    it('never steps onto a pinned, face-up or matched card, its partner, another Wanderer, or the locked cell', () => {
        for (let level = 13; level <= 40; level += 1) {
            const board = dealt(level);
            const pinned = board.tiles.filter((tile) => !tile.wanderer).slice(0, 3).map((tile) => tile.id);
            const faceUp = new Set(board.tiles.filter((tile) => !tile.wanderer).slice(3, 5).map((tile) => tile.id));
            const shown: BoardState = { ...board, tiles: board.tiles.map((tile) => (faceUp.has(tile.id) ? { ...tile, state: 'matched' as const } : tile)) };
            const steps = resolveWandererSteps({ board: shown, turnsThisFloor: 3, pinnedTileIds: pinned, lockedIndex: 7, runSeed: level, rulesVersion: GAME_RULES_VERSION });
            const touched = new Set<number>();
            for (const { from, to } of steps) {
                const walker = shown.tiles[from]!;
                const there = shown.tiles[to]!;
                expect(walker.wanderer).toBe(true);
                expect(there.state).toBe('hidden');
                expect(there.wanderer).toBeFalsy();
                expect(there.pairKey).not.toBe(walker.pairKey);
                expect(pinned).not.toContain(there.id);
                expect([from, to]).not.toContain(7);
                expect(orthogonal(from, to, shown.columns)).toBe(true);
                // Each card moves at most once a tick.
                expect(touched.has(from) || touched.has(to)).toBe(false);
                touched.add(from);
                touched.add(to);
            }
            const after = applyWandererSteps(shown, steps);
            expect(after.tiles.map((tile) => tile.id).sort()).toEqual(shown.tiles.map((tile) => tile.id).sort());
        }
    });

    it('a pinned Wanderer stays', () => {
        const board = dealt(13);
        const pinned = board.tiles.filter((tile) => tile.wanderer).map((tile) => tile.id);
        expect(resolveWandererSteps({ board, turnsThisFloor: 3, pinnedTileIds: pinned, runSeed: SEED, rulesVersion: GAME_RULES_VERSION })).toEqual([]);
    });
});
