import { describe, expect, it } from 'vitest';

import { type BoardState, type RunState, type Tile } from './contracts';
import { createNewRun } from './run-creation-rules';
import { calculateMismatchPenalty, createHiddenMismatchBoard, resolveMismatchTurnTransition } from './turn-mismatch-rules';

const tile = (id: string, state: Tile['state'] = 'flipped', overrides: Partial<Tile> = {}): Tile => ({
    id,
    pairKey: id,
    symbol: id,
    label: id,
    state,
    ...overrides
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState => ({
    ...createNewRun(0, { runSeed: 21_001 }).board!,
    tiles,
    flippedTileIds: tiles.filter((candidate) => candidate.state === 'flipped').map((candidate) => candidate.id),
    ...overrides
});

const run = (b: BoardState, overrides: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 21_002 }),
    board: b,
    stats: {
        ...createNewRun(0, { runSeed: 21_003 }).stats,
        tries: 2
    },
    ...overrides
});

describe('turn mismatch rules', () => {
    it('hides the mismatched tiles and leaves the rest of the board alone', () => {
        const b = board([tile('a'), tile('b'), tile('gone', 'removed')]);

        const hidden = createHiddenMismatchBoard(b, ['a', 'gone']);

        expect(hidden.flippedTileIds).toEqual([]);
        expect(hidden.tiles.find((candidate) => candidate.id === 'a')?.state).toBe('hidden');
        expect(hidden.tiles.find((candidate) => candidate.id === 'b')?.state).toBe('flipped');
        expect(hidden.tiles.find((candidate) => candidate.id === 'gone')?.state).toBe('removed');
    });

    it('costs a try and nothing else: there are no lives to lose', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b), 1);

        expect(penalty).toEqual({
            contractFail: false,
            status: 'playing',
            tries: 3
        });
    });

    it('normalizes malformed mismatch penalty counters before counting the try', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            stats: { ...run(b).stats, tries: Number.NaN }
        }), 1.9);

        expect(penalty).toEqual({
            contractFail: false,
            status: 'playing',
            tries: 1
        });
    });

    it('normalizes malformed stat blocks before calculating mismatch penalties', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            stats: Number.NaN as unknown as RunState['stats']
        }), 1);

        expect(penalty).toEqual({
            contractFail: false,
            status: 'playing',
            tries: 1
        });
    });

    it('forces game over when mismatch contract is exceeded', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            activeContract: { noShuffle: false, maxMismatches: 2 },
            stats: { ...run(b).stats, tries: 2 }
        }), 1);

        expect(penalty.contractFail).toBe(true);
        expect(penalty.status).toBe('gameOver');
    });

    it('names the contract as the reason the run ended', () => {
        const b = board([tile('a'), tile('b')]);
        const base = run(b, {
            activeContract: { noShuffle: false, maxMismatches: 2 },
            stats: { ...run(b).stats, tries: 2 }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['a', 'b'],
            sourceTiles: b.tiles,
            triesDelta: 1,
        });

        expect(resolved.status).toBe('gameOver');
        expect(resolved.runEndReason).toBe('contract');
    });

    it('normalizes malformed persisted counters during mismatch transition bookkeeping', () => {
        const b = board([
            tile('heavy-a', 'flipped', { pairKey: 'heavy', tileTraitKind: 'heavy' }),
            tile('heavy-b', 'flipped', { pairKey: 'heavy', tileTraitKind: 'heavy' })
        ]);
        const base = run(b, {
            peekCharges: 2.9,
            recallMistakesThisFloor: Number.NaN,
            stats: {
                ...run(b).stats,
                tries: Number.NaN,
                mismatches: Number.POSITIVE_INFINITY,
                currentStreak: Number.POSITIVE_INFINITY,
                highestLevel: Number.NaN
            }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['heavy-a', 'heavy-b'],
            sourceTiles: b.tiles,
            triesDelta: 1.9,
        });

        expect(resolved.recallMistakesThisFloor).toBe(1);
        // 1.9 normalizes to 1, and Heavy's extra try lands on top of it.
        expect(resolved.stats.tries).toBe(2);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(0);
        expect(resolved.stats.highestLevel).toBe(1);
    });

    it('normalizes malformed stat blocks during mismatch transition bookkeeping', () => {
        const b = board([tile('a'), tile('b')]);
        const base = run(b, {
            stats: Number.NaN as unknown as RunState['stats']
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['a', 'b'],
            sourceTiles: b.tiles,
            triesDelta: 1,
        });

        expect(resolved.stats.tries).toBe(1);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(0);
        expect(resolved.stats.highestLevel).toBe(1);
    });


    it('tracks trait mismatch counters per kind', () => {
        const b = board([
            tile('heavy-a', 'flipped', { pairKey: 'heavy', tileTraitKind: 'heavy' }),
            tile('echo-a', 'flipped', { pairKey: 'echo', tileTraitKind: 'echo' }),
            tile('safe-a', 'hidden', { pairKey: 'safe' }),
            tile('safe-b', 'hidden', { pairKey: 'safe' }),
            tile('extra-a', 'hidden', { pairKey: 'extra' }),
            tile('extra-b', 'hidden', { pairKey: 'extra' })
        ]);
        const base = run(b, {
            stats: { ...run(b).stats, tries: 1, mismatches: 0 }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['heavy-a', 'echo-a'],
            sourceTiles: [b.tiles[0]!, b.tiles[1]!],
            triesDelta: 1,
        });

        expect(resolved.stats.tileTraitMismatches.heavy).toBe(1);
        expect(resolved.stats.tileTraitMismatches.echo).toBe(1);
        // Heavy is the one kept trait with a miss cost: one extra try on top of the miss itself.
        expect(resolved.stats.tries).toBe(3);
    });


});

describe('the magpie on a real miss', () => {
    const magpieBoard = () =>
        board([
            tile('x-A', 'flipped'),
            tile('y-A', 'flipped', { pairKey: 'y' }),
            tile('cleared-A', 'matched', { pairKey: 'cleared' }),
            tile('cleared-B', 'matched', { pairKey: 'cleared' }),
            tile('z-A', 'hidden', { pairKey: 'z' }),
            tile('z-B', 'hidden', { pairKey: 'z' })
        ], { matchedPairs: 1 });

    const missWithMagpie = (mismatches: number, mutators: RunState['activeMutators'] = ['magpie_thief']) => {
        const b = magpieBoard();
        const base = run(b);
        return resolveMismatchTurnTransition({
            run: {
                ...base,
                activeMutators: mutators,
                stats: { ...base.stats, mismatches }
            },
            board: b,
            tileIds: ['x-A', 'y-A'],
            sourceTiles: [b.tiles[0]!, b.tiles[1]!],
            triesDelta: 1,
        });
    };

    it('takes back a cleared pair on its turn, and leaves the score alone', () => {
        // Third miss: the bird arrives. The pair it took is face down again.
        const after = missWithMagpie(2);
        expect(after.board?.matchedPairs).toBe(0);
        expect(after.board?.tiles.filter((t) => t.pairKey === 'cleared').every((t) => t.state === 'hidden')).toBe(true);
        expect(after.stats.totalScore).toBe(run(magpieBoard()).stats.totalScore);
    });

    it('leaves the board alone on a miss that is not its turn', () => {
        const after = missWithMagpie(0);
        expect(after.board?.matchedPairs).toBe(1);
    });

    it('does not visit a floor it was never nesting on', () => {
        const after = missWithMagpie(2, []);
        expect(after.board?.matchedPairs).toBe(1);
    });
});

/*
 * The turn ceiling that used to end a run from here (Gen 183 to 2026-09-23) is gone; the run ends
 * on its misses now, and `miss-bank.test.ts` walks that through this same turn path.
 */
