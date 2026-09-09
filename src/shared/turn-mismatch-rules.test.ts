import { describe, expect, it } from 'vitest';

import { type BoardState, type RunState, type Tile } from './contracts';
import { parTurnsForFloor, turnCeilingForFloor, TURN_CEILING_PAR_MULTIPLIER } from './floor-par';
import { flipTile, resolveBoardTurn } from './game';
import { createNewRun } from './run-creation-rules';
import { makeRun, makeTile } from './test/game-fixtures';
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
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 2 },
            stats: { ...run(b).stats, tries: 2 }
        }), 1);

        expect(penalty.contractFail).toBe(true);
        expect(penalty.status).toBe('gameOver');
    });

    it('names the contract as the reason the run ended', () => {
        const b = board([tile('a'), tile('b')]);
        const base = run(b, {
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 2 },
            stats: { ...run(b).stats, tries: 2 }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['a', 'b'],
            sourceTiles: b.tiles,
            triesDelta: 1,
            decoyTouched: false
        });

        expect(resolved.status).toBe('gameOver');
        expect(resolved.runEndReason).toBe('contract');
    });

    it('resolves mismatch transition bookkeeping', () => {
        const b = board([tile('a'), tile('b')]);
        const base = run(b, {
            recallFocus: 2,
            forgottenTileIdsThisFloor: ['old'],
            stats: { ...run(b).stats, currentStreak: 5, tries: 1, mismatches: 2 }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['a', 'b'],
            sourceTiles: b.tiles,
            triesDelta: 1,
            decoyTouched: true
        });

        expect(resolved.status).toBe('playing');
        expect(resolved.runEndReason).toBeNull();
        expect(resolved.board?.flippedTileIds).toEqual([]);
        expect(resolved.board?.tiles.map((candidate) => candidate.state)).toEqual(['hidden', 'hidden']);
        expect(resolved.recallFocus).toBe(1);
        expect(resolved.recallMistakesThisFloor).toBe(base.recallMistakesThisFloor + 1);
        expect(resolved.forgottenTileIdsThisFloor).toEqual(['old', 'a', 'b']);
        expect(resolved.decoyFlippedThisFloor).toBe(true);
        expect(resolved.turnsThisFloor).toBe(base.turnsThisFloor + 1);
        expect(resolved.stats.tries).toBe(2);
        expect(resolved.stats.mismatches).toBe(3);
        expect(resolved.stats.currentStreak).toBe(2);
        expect(resolved.stickyBlockIndex).toBeNull();
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
            decoyTouched: false
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
            decoyTouched: false
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
            decoyTouched: false
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
            decoyTouched: false
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
 * The turn ceiling (thesis §42.2): the one way a floor ends a run. Two pairs par at one turn, so
 * the ceiling is three; every turn below is played through the real flip/resolve path.
 */
describe('the turn ceiling', () => {
    const twoPairRun = () =>
        makeRun([
            makeTile('a-1', 'a', 'A'),
            makeTile('a-2', 'a', 'A'),
            makeTile('b-1', 'b', 'B'),
            makeTile('b-2', 'b', 'B')
        ]);
    const play = (run: RunState, first: string, second: string) => resolveBoardTurn(flipTile(flipTile(run, first), second));
    const miss = (run: RunState) => play(run, 'a-1', 'b-1');
    const ceiling = turnCeilingForFloor(2);

    it('is three times par', () => {
        expect(TURN_CEILING_PAR_MULTIPLIER).toBe(3);
        expect(parTurnsForFloor(2)).toBe(1);
        expect(ceiling).toBe(3);
        expect(turnCeilingForFloor(14)).toBe(parTurnsForFloor(14) * 3);
    });

    it('ends a floor never cleared exactly on turn three times par, with nothing left face up', () => {
        let run = twoPairRun();
        for (let turn = 1; turn < ceiling; turn += 1) {
            run = miss(run);
            expect(run.status).toBe('playing');
            expect(run.runEndReason).toBeNull();
            expect(run.turnsThisFloor).toBe(turn);
        }

        const ended = miss(run);

        expect(ended.turnsThisFloor).toBe(ceiling);
        expect(ended.status).toBe('gameOver');
        expect(ended.runEndReason).toBe('turn_ceiling');
        expect(ended.board?.flippedTileIds).toEqual([]);
        expect(ended.board?.tiles.every((t) => t.state === 'hidden')).toBe(true);
    });

    it('ends the run on a match that leaves the floor open on the ceiling turn', () => {
        const ended = play(miss(miss(twoPairRun())), 'a-1', 'a-2');

        expect(ended.turnsThisFloor).toBe(ceiling);
        expect(ended.board?.matchedPairs).toBe(1);
        expect(ended.status).toBe('gameOver');
        expect(ended.runEndReason).toBe('turn_ceiling');
        expect(ended.board?.flippedTileIds).toEqual([]);
    });

    it('is a clear, not an end, when the floor clears on that same turn', () => {
        const cleared = play(play(miss(twoPairRun()), 'a-1', 'a-2'), 'b-1', 'b-2');

        expect(cleared.turnsThisFloor).toBe(ceiling);
        expect(cleared.status).toBe('levelComplete');
        expect(cleared.runEndReason).toBeNull();
        expect(cleared.lastLevelResult?.turnsTaken).toBe(ceiling);
    });

    it('leaves the run playing after a match on a turn before the ceiling', () => {
        const matched = play(miss(twoPairRun()), 'a-1', 'a-2');

        expect(matched.turnsThisFloor).toBe(2);
        expect(matched.status).toBe('playing');
        expect(matched.runEndReason).toBeNull();
    });
});
