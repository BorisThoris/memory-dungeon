import { describe, expect, it } from 'vitest';
import { GAME_RULES_VERSION, type BoardState, type RunState, type Tile, type TileSuit } from './contracts';
import { createNewRun, finishMemorizePhase } from './game';
import { findSuitRegion, resolveChunkBreak } from './chunk-break-rules';
import { VERB_LEGACY_FIRST_FLOORS, VERB_STAIRCASE_FIRST_FLOORS } from './verb-staircase-rules';
import { canCarve, carve, CARVE_FROM, CARVE_LINKS, spendCarveOnPop } from './carve-rules';

const deepRun = (extra: Partial<RunState> = {}): RunState => {
    const base = finishMemorizePhase(createNewRun(0, { runSeed: 7777, gameMode: 'endless' }));
    return { ...base, status: 'playing', runRulesVersion: GAME_RULES_VERSION, board: { ...base.board!, level: VERB_LEGACY_FIRST_FLOORS.carve, flippedTileIds: [] }, holdLinks: 4, ...extra };
};

/** One row of cards: `key:suit` per cell, `-` for a cleared one. */
const row = (cells: string[], template: Tile): BoardState => {
    const tiles = cells.map((cell, index): Tile => {
        if (cell === '-') return { ...template, id: `gone-${index}`, pairKey: `gone-${index}`, state: 'removed', suit: undefined };
        const [key, suit] = cell.split(':') as [string, TileSuit];
        const half = cells.slice(0, index).filter((other) => other.startsWith(`${key}:`)).length;
        return { ...template, id: `${key}-${half + 1}`, pairKey: key, state: 'hidden', suit, findableKind: undefined };
    });
    return { ...deepRun().board!, tiles, columns: cells.length, rows: 1, fold: undefined, cursedPairKey: null } as BoardState;
};

describe('Carve (DGE-015)', () => {
    it('is set between turns from the Deep, for two links, one at a time', () => {
        const run = deepRun();
        expect(canCarve(run)).toBe(true);
        const carved = carve(run, 'right');
        expect(carved.carveDirection).toBe('right');
        expect(carved.holdLinks).toBe(4 - CARVE_LINKS);
        expect(carved.carvesThisFloor).toBe(1);
        // Never a turn or a miss.
        expect(carved.turnsThisFloor).toBe(run.turnsThisFloor);
        expect(carved.stats.tries).toBe(run.stats.tries);
        expect(canCarve(carved)).toBe(false);
        expect(canCarve(deepRun({ holdLinks: 1 }))).toBe(false);
        expect(canCarve(deepRun({ runRulesVersion: CARVE_FROM - 1 }))).toBe(false);
        expect(canCarve(deepRun({ board: { ...deepRun().board!, level: VERB_STAIRCASE_FIRST_FLOORS.carve - 1 } }))).toBe(false);
    });

    it('a carved reaction burst takes the carved side first, and one pair more', () => {
        const template = deepRun().board!.tiles[0]!;
        // p p M M q q: p and q lie one step from the match; the plain order takes p (it comes first).
        const board = row(['p:ember', 'p:ember', 'm:ember', 'm:ember', 'q:ember', 'q:ember'], template);
        const burst = (carveDirection: RunState['carveDirection'], pairsPerSuit: number) =>
            resolveChunkBreak({ board, run: { floorCurioId: null, carveDirection }, matchedTileIds: ['m-1', 'm-2'], chain: 0, spec: { suits: ['ember'], pairsPerSuit } }).brokenPairKeys;
        expect(burst(null, 1)).toEqual(['p']);
        expect(burst('right', 0)).toEqual(['q']);
        expect(burst('right', 1)).toEqual(['q', 'p']);
        expect(burst('left', 0)).toEqual(['p']);
        // Nothing on the carved side: the plain order, and the extra pair still comes.
        expect(burst('up', 0)).toEqual(['p']);
    });

    it('a carved contact walk reaches one card further along its axis', () => {
        const template = deepRun().board!.tiles[0]!;
        const board = row(['m:ember', 'a:ember', 'b:ember', 'c:ember'], template);
        // From m-1 at depth 1 the walk reaches a-1; carved right, the step on from a-1 reaches b-1.
        const plain = findSuitRegion(board, ['m-1'], 1);
        const carved = findSuitRegion(board, ['m-1'], 1, { carve: 'right' });
        expect(plain).toEqual([1]);
        expect(carved).toEqual([1, 2]);
        expect(findSuitRegion(board, ['m-1'], 1, { carve: 'left' })).toEqual([1]);
    });

    it('a turn whose pop took pairs spends the carve; one that popped nothing keeps it', () => {
        const run = carve(deepRun(), 'down');
        const popped = { ...run, chunkPairsBrokenThisFloor: run.chunkPairsBrokenThisFloor + 2 };
        expect(spendCarveOnPop(run, popped).carveDirection).toBeNull();
        expect(spendCarveOnPop(run, popped).carvesSpentThisFloor).toBe(1);
        expect(spendCarveOnPop(run, { ...run }).carveDirection).toBe('down');
    });
});
