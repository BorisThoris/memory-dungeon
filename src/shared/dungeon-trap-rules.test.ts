import { describe, expect, it } from 'vitest';
import type { BoardState, RunState, Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    DUNGEON_HEX_TRAP_SCORE_PENALTY,
    DUNGEON_TRAP_SCORE_PENALTY,
    resolveOneArmedTrapPair,
    revealDungeonCardPair,
    springArmedDungeonTraps
} from './dungeon-trap-rules';

const tile = (id: string, pairKey: string, overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state: 'hidden',
    ...overrides
});

const createBoard = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => {
    const base = createNewRun(0).board!;
    return {
        ...base,
        columns: 2,
        rows: Math.ceil(tiles.length / 2),
        level: 2,
        pairCount: Math.max(1, new Set(tiles.map((candidate) => candidate.pairKey)).size),
        matchedPairs: 0,
        flippedTileIds: [],
        tiles,
        ...overrides
    };
};

describe('dungeon-trap-rules', () => {
    it('ignores empty or unarmed trap key input', () => {
        const run = createNewRun(0);
        const board = createBoard([tile('a', 'trap')]);

        expect(springArmedDungeonTraps(run, board, [])).toEqual({
            alarmTriggered: false,
            board,
            enemyWoken: false,
            run
        });
        expect(springArmedDungeonTraps(run, board, ['trap'])).toEqual({
            alarmTriggered: false,
            board,
            enemyWoken: false,
            run
        });
    });

    it('springs mimic traps, applies score penalty, and clamps shop gold', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            lives: 2,
            shopGold: 0,
            stats: {
                ...base.stats,
                currentLevelScore: 5,
                totalScore: 5
            }
        };
        const board = createBoard([
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', dungeonCardEffectId: 'trap_mimic' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', dungeonCardEffectId: 'trap_mimic' })
        ]);

        const result = springArmedDungeonTraps(run, board, ['trap']);

        expect(result.run.lives).toBe(1);
        expect(result.run.shopGold).toBe(0);
        expect(result.run.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered + 1);
        expect(result.run.stats.currentLevelScore).toBe(0);
        expect(result.run.stats.totalScore).toBe(0);
        expect(result.board.matchedPairs).toBe(1);
        expect(result.board.tiles.every((candidate) => candidate.dungeonCardState === 'resolved')).toBe(true);
    });

    it('normalizes malformed trap counters before resolving traps', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            lives: 2.9,
            shopGold: Number.POSITIVE_INFINITY,
            dungeonTrapsTriggered: Number.NaN,
            dungeonTrapsResolvedThisFloor: 1.9,
            stats: {
                ...base.stats,
                guardTokens: Number.NaN,
                currentLevelScore: Number.POSITIVE_INFINITY,
                totalScore: 15.9
            }
        };
        const board = {
            ...createBoard([
                tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', dungeonCardEffectId: 'trap_mimic' }),
                tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', dungeonCardEffectId: 'trap_mimic' })
            ]),
            matchedPairs: Number.NaN
        };

        const result = springArmedDungeonTraps(run, board, ['trap']);

        expect(result.run.lives).toBe(1);
        expect(result.run.shopGold).toBe(0);
        expect(result.run.dungeonTrapsTriggered).toBe(1);
        expect(result.run.dungeonTrapsResolvedThisFloor).toBe(2);
        expect(result.run.stats.guardTokens).toBe(0);
        expect(result.run.stats.currentLevelScore).toBe(0);
        expect(result.run.stats.totalScore).toBe(5);
        expect(result.board.matchedPairs).toBe(1);
    });

    it('normalizes malformed stat records before resolving traps', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            lives: 2,
            stats: Number.NaN as unknown as RunState['stats']
        };
        const board = createBoard([
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' })
        ]);

        const result = springArmedDungeonTraps(run, board, ['trap']);

        expect(result.run.lives).toBe(1);
        expect(result.run.stats.guardTokens).toBe(0);
        expect(result.run.stats.totalScore).toBe(0);
        expect(result.run.stats.currentLevelScore).toBe(0);
    });

    it('spends guard tokens on ordinary traps before life loss', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            lives: 2,
            stats: {
                ...base.stats,
                guardTokens: 1,
                currentLevelScore: 20,
                totalScore: 20
            }
        };
        const board = createBoard([
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' })
        ]);

        const result = springArmedDungeonTraps(run, board, ['trap']);

        expect(result.run.lives).toBe(2);
        expect(result.run.stats.guardTokens).toBe(0);
        expect(result.run.stats.currentLevelScore).toBe(20 - DUNGEON_TRAP_SCORE_PENALTY);
    });

    it('reveals enemies from alarm traps and hidden hazards from hex traps', () => {
        const base = createNewRun(0);
        const run = {
            ...base,
            stats: {
                ...base.stats,
                currentLevelScore: 50,
                totalScore: 50
            }
        };
        const board = createBoard([
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', dungeonCardEffectId: 'trap_hex' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', dungeonCardEffectId: 'trap_hex' }),
            tile('enemy-a', 'enemy', { dungeonCardKind: 'enemy', dungeonCardState: 'hidden' }),
            tile('enemy-b', 'enemy', { dungeonCardKind: 'enemy', dungeonCardState: 'hidden' })
        ]);

        const result = springArmedDungeonTraps(run, board, ['trap']);

        expect(result.enemyWoken).toBe(true);
        expect(result.run.stats.currentLevelScore).toBe(50 - DUNGEON_TRAP_SCORE_PENALTY - DUNGEON_HEX_TRAP_SCORE_PENALTY);
        expect(result.board.tiles.filter((candidate) => candidate.pairKey === 'enemy')).toEqual(
            expect.arrayContaining([expect.objectContaining({ dungeonCardState: 'revealed' })])
        );
    });

    it('reveals a hidden dungeon pair and springs trap pairs immediately', () => {
        const run = createNewRun(0);
        const board = createBoard([
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'hidden' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'hidden' })
        ]);

        const revealedRun = revealDungeonCardPair({ ...run, board }, board.tiles[0]!);

        expect(revealedRun.board?.tiles.every((candidate) => candidate.dungeonCardState === 'resolved')).toBe(true);
        expect(revealedRun.dungeonTrapsTriggered).toBe(run.dungeonTrapsTriggered + 1);
    });

    it('resolves one revealed trap pair', () => {
        const board = createBoard([
            tile('trap-a', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
            tile('trap-b', 'trap', { dungeonCardKind: 'trap', dungeonCardState: 'revealed' }),
            tile('other-a', 'other', { dungeonCardKind: 'trap', dungeonCardState: 'revealed', state: 'matched' })
        ]);

        const resolved = resolveOneArmedTrapPair(board);

        expect(resolved.tiles.filter((candidate) => candidate.pairKey === 'trap')).toEqual(
            expect.arrayContaining([expect.objectContaining({ dungeonCardState: 'resolved' })])
        );
        expect(resolved.tiles.find((candidate) => candidate.id === 'other-a')?.dungeonCardState).toBe('revealed');
    });
});
