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
    pendingMemorizeBonusMs: 0,
    stats: {
        ...createNewRun(0, { runSeed: 21_003 }).stats,
        tries: 2,
        guardTokens: 0
    },
    ...overrides
});

describe('turn mismatch rules', () => {
    it('hides mismatched tiles and preserves sprung trap state', () => {
        const b = board([
            tile('a'),
            tile('b'),
            tile('trap', 'flipped', { dungeonCardKind: 'trap', dungeonCardState: 'resolved' })
        ]);

        const hidden = createHiddenMismatchBoard(b, ['a', 'trap']);

        expect(hidden.flippedTileIds).toEqual([]);
        expect(hidden.tiles.find((candidate) => candidate.id === 'a')?.state).toBe('hidden');
        expect(hidden.tiles.find((candidate) => candidate.id === 'b')?.state).toBe('flipped');
        expect(hidden.tiles.find((candidate) => candidate.id === 'trap')?.state).toBe('flipped');
    });

    it('uses guard tokens before life loss', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            stats: { ...run(b).stats, guardTokens: 1 }
        }), b, 1);

        expect(penalty).toMatchObject({
            consumesGuardToken: true,
            guardTokens: 0,
            lives: 4,
            lostLife: false,
            status: 'playing',
            tries: 3
        });
    });

    it('normalizes malformed mismatch penalty counters before applying life and guard loss', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            lives: 2.9,
            stats: { ...run(b).stats, tries: Number.NaN, guardTokens: Number.POSITIVE_INFINITY }
        }), b, 1.9);

        expect(penalty).toMatchObject({
            consumesGuardToken: false,
            guardTokens: 0,
            lives: 2,
            lostLife: false,
            status: 'playing',
            tries: 1
        });
    });

    it('normalizes malformed stat blocks before calculating mismatch penalties', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            lives: 2,
            stats: Number.NaN as unknown as RunState['stats']
        }), b, 1);

        expect(penalty).toMatchObject({
            guardTokens: 0,
            lives: 2,
            status: 'playing',
            tries: 1
        });
    });

    it('applies first mismatch grace when eligible', () => {
        const b = board([tile('a'), tile('b')], { matchedPairs: 0 });
        const penalty = calculateMismatchPenalty(run(b, {
            stats: { ...run(b).stats, tries: 0, guardTokens: 0 },
            lives: 2
        }), b, 1);

        expect(penalty.hasGraceMismatch).toBe(true);
        expect(penalty.lostLife).toBe(false);
        expect(penalty.lives).toBe(2);
    });

    it('forces game over when mismatch contract is exceeded', () => {
        const b = board([tile('a'), tile('b')]);
        const penalty = calculateMismatchPenalty(run(b, {
            activeContract: { noShuffle: false, noDestroy: false, maxMismatches: 2 },
            stats: { ...run(b).stats, tries: 2, guardTokens: 0 }
        }), b, 1);

        expect(penalty.contractFail).toBe(true);
        expect(penalty.lives).toBe(0);
        expect(penalty.status).toBe('gameOver');
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

        expect(resolved.board?.flippedTileIds).toEqual([]);
        expect(resolved.board?.tiles.map((candidate) => candidate.state)).toEqual(['hidden', 'hidden']);
        expect(resolved.recallFocus).toBe(1);
        expect(resolved.recallMistakesThisFloor).toBe(base.recallMistakesThisFloor + 1);
        expect(resolved.forgottenTileIdsThisFloor).toEqual(['old', 'a', 'b']);
        expect(resolved.decoyFlippedThisFloor).toBe(true);
        expect(resolved.stats.tries).toBe(2);
        expect(resolved.stats.mismatches).toBe(3);
        expect(resolved.stats.currentStreak).toBe(2);
        expect(resolved.stickyBlockIndex).toBeNull();
    });

    it('normalizes malformed persisted counters during mismatch transition bookkeeping', () => {
        const b = board([
            tile('sealed-a', 'flipped', { pairKey: 'sealed', tileTraitKind: 'sealed' }),
            tile('sealed-b', 'flipped', { pairKey: 'sealed', tileTraitKind: 'sealed' })
        ]);
        const base = run(b, {
            hazardTileTriggersThisFloor: Number.NaN,
            hazardShuffleSnaresThisFloor: -2,
            hazardMirrorDecoysThisFloor: 1.9,
            hazardFragileCacheBreaksThisFloor: Number.POSITIVE_INFINITY,
            safeHazardWardChargesThisFloor: 1.9,
            safeHazardWardsUsedThisFloor: Number.NaN,
            peekCharges: 2.9,
            recallMistakesThisFloor: Number.NaN,
            stats: {
                ...run(b).stats,
                tries: Number.NaN,
                mismatches: Number.POSITIVE_INFINITY,
                currentStreak: Number.POSITIVE_INFINITY,
                highestLevel: Number.NaN,
                guardTokens: Number.NaN,
                volatileTraitShuffles: Number.POSITIVE_INFINITY
            }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['sealed-a', 'sealed-b'],
            sourceTiles: b.tiles,
            triesDelta: 1.9,
            decoyTouched: false
        });

        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
        expect(resolved.hazardShuffleSnaresThisFloor).toBe(0);
        expect(resolved.hazardMirrorDecoysThisFloor).toBe(1);
        expect(resolved.hazardFragileCacheBreaksThisFloor).toBe(0);
        expect(resolved.safeHazardWardChargesThisFloor).toBe(1);
        expect(resolved.safeHazardWardsUsedThisFloor).toBe(0);
        expect(resolved.peekCharges).toBe(1);
        expect(resolved.recallMistakesThisFloor).toBe(1);
        expect(resolved.stats.tries).toBe(1);
        expect(resolved.stats.mismatches).toBe(1);
        expect(resolved.stats.currentStreak).toBe(0);
        expect(resolved.stats.highestLevel).toBe(1);
        expect(resolved.stats.guardTokens).toBe(0);
        expect(resolved.stats.volatileTraitShuffles).toBe(0);
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
        expect(resolved.stats.guardTokens).toBe(0);
    });

    it('adds boss identity mismatch pressure on boss floors', () => {
        const b = board([tile('a'), tile('b')], {
            floorTag: 'boss',
            dungeonBossId: 'spire_observer'
        });
        const base = run(b, {
            stats: { ...run(b).stats, tries: 1, mismatches: 0 }
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['a', 'b'],
            sourceTiles: b.tiles,
            triesDelta: 1,
            decoyTouched: false
        });

        expect(resolved.stats.tries).toBe(3);
        expect(resolved.stats.mismatches).toBe(1);
    });

    it('tracks trait mismatch and volatile shuffle counters', () => {
        const b = board([
            tile('volatile-a', 'flipped', { pairKey: 'volatile', tileTraitKind: 'volatile' }),
            tile('mirror-a', 'flipped', { pairKey: 'mirror', tileTraitKind: 'mirror' }),
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
            tileIds: ['volatile-a', 'mirror-a'],
            sourceTiles: [b.tiles[0]!, b.tiles[1]!],
            triesDelta: 1,
            decoyTouched: false
        });

        expect(resolved.stats.tileTraitMismatches.volatile).toBe(1);
        expect(resolved.stats.tileTraitMismatches.mirror).toBe(1);
        expect(resolved.stats.volatileTraitShuffles).toBe(1);
    });

    it('lets Stasis absorb snare mismatches without negative ward charges', () => {
        const b = board([
            tile('snare-a', 'flipped', {
                pairKey: 'snare',
                tileHazardKind: 'shuffle_snare',
                tileTraitKind: 'stasis'
            }),
            tile('safe-a', 'flipped', { pairKey: 'safe' }),
            tile('safe-b', 'hidden', { pairKey: 'safe' }),
            tile('extra-a', 'hidden', { pairKey: 'extra' }),
            tile('extra-b', 'hidden', { pairKey: 'extra' })
        ]);
        const base = run(b, {
            safeHazardWardChargesThisFloor: 0,
            safeHazardWardsUsedThisFloor: 0
        });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['snare-a', 'safe-a'],
            sourceTiles: [b.tiles[0]!, b.tiles[1]!],
            triesDelta: 1,
            decoyTouched: false
        });

        expect(resolved.safeHazardWardChargesThisFloor).toBe(0);
        expect(resolved.safeHazardWardsUsedThisFloor).toBe(1);
        expect(resolved.hazardShuffleSnaresThisFloor).toBe(0);
        expect(resolved.hazardTileTriggersThisFloor).toBe(0);
    });

    it('springs revealed trap mismatches through the transition', () => {
        const b = board([
            tile('trap-a', 'flipped', {
                pairKey: 'trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed'
            }),
            tile('trap-b', 'flipped', {
                pairKey: 'trap',
                dungeonCardKind: 'trap',
                dungeonCardState: 'revealed'
            }),
            tile('c')
        ]);
        const base = run(b, { lives: 3 });

        const resolved = resolveMismatchTurnTransition({
            run: base,
            board: b,
            tileIds: ['trap-a', 'c'],
            sourceTiles: [b.tiles[0]!, b.tiles[2]!],
            triesDelta: 1,
            decoyTouched: false
        });

        expect(resolved.dungeonTrapsTriggered).toBe(base.dungeonTrapsTriggered + 1);
        expect(resolved.lives).toBeLessThanOrEqual(3);
        expect(resolved.board?.tiles.find((candidate) => candidate.id === 'trap-a')?.dungeonCardState).toBe('resolved');
    });
});
