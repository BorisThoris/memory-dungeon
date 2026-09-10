import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RunState,
    Tile
} from './contracts';
import {
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyTileSwap,
    cancelResolvingWithUndo
} from './board-power-actions';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state
});

const board = (tiles: Tile[], columns = 2): BoardState => ({
    level: 1,
    pairCount: 0,
    columns,
    rows: Math.ceil(tiles.length / columns),
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

const defaultBoard = (): BoardState => board([
    tile('a1', 'A'),
    tile('a2', 'A'),
    tile('b1', 'B'),
    tile('b2', 'B')
]);

const run = (overrides: Partial<RunState> = {}): RunState => ({
    status: 'playing',
    board: defaultBoard(),
    runSeed: 7,
    runRulesVersion: 1,
    shuffleNonce: 0,
    shuffleCharges: 1,
    freeShuffleThisFloor: false,
    regionShuffleCharges: 1,
    regionShuffleFreeThisFloor: false,
    flashPairCharges: 1,
    peekCharges: 1,
    practiceMode: true,
    wildMenuRun: false,
    weakerShuffleMode: null,
    shuffleScoreTaxActive: false,
    matchScoreMultiplier: 1,
    activeMutators: [],
    pinnedTileIds: ['a1'],
    forgottenTileIdsThisFloor: [],
    peekRevealedTileIds: [],
    flashPairRevealedTileIds: [],
    powersUsedThisRun: false,
    shuffleUsedThisFloor: false,
    recallFocus: 2,
    stats: {
        shufflesUsed: 0,
        matchesFound: 0,
        pairsDestroyed: 0
    },
    ...overrides
} as RunState);

describe('board power actions', () => {





    it('applies full-board shuffle accounting without disturbing visible matched tiles', () => {
        const state = run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B'),
                tile('matched', 'C', 'matched')
            ]),
            shuffleScoreTaxActive: true
        });

        const shuffled = applyShuffle(state);

        expect(shuffled).not.toBe(state);
        expect(shuffled.shuffleCharges).toBe(0);
        expect(shuffled.shuffleNonce).toBe(1);
        expect(shuffled.powersUsedThisRun).toBe(true);
        expect(shuffled.shuffleUsedThisFloor).toBe(true);
        expect(shuffled.pinnedTileIds).toEqual([]);
        expect(shuffled.recallFocus).toBe(0);
        expect(shuffled.matchScoreMultiplier).toBeCloseTo(0.94);
        expect(shuffled.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'a2', 'b1', 'b2']));
        expect(shuffled.stats.shufflesUsed).toBe(1);
        expect(shuffled.board!.tiles.find((t) => t.id === 'matched')?.state).toBe('matched');
    });

    it('normalizes malformed stat blocks before applying shuffle accounting', () => {
        const shuffled = applyShuffle(run({
            stats: Number.NaN as unknown as RunState['stats']
        }));

        expect(shuffled.stats.shufflesUsed).toBe(1);
        expect(shuffled.stats.highestLevel).toBe(1);
    });



    it('applies row shuffle only to rows with at least two hidden tiles', () => {
        const state = run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B', 'matched')
            ], 2)
        });

        const wrongRow = applyRegionShuffle(state, 1);
        expect(wrongRow).toBe(state);

        const shuffled = applyRegionShuffle(state, 0);
        expect(shuffled).not.toBe(state);
        expect(shuffled.regionShuffleCharges).toBe(0);
        expect(shuffled.pinnedTileIds).toEqual([]);
        expect(shuffled.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'a2']));
        expect(shuffled.stats.shufflesUsed).toBe(1);
        expect(shuffled.board!.tiles[2]?.id).toBe('b1');
        expect(shuffled.board!.tiles[3]?.id).toBe('b2');
    });

    it('normalizes malformed stat blocks before applying row shuffle accounting', () => {
        const shuffled = applyRegionShuffle(run({
            stats: Number.NaN as unknown as RunState['stats']
        }), 0);

        expect(shuffled.stats.shufflesUsed).toBe(1);
        expect(shuffled.stats.highestLevel).toBe(1);
    });

    it('swaps two hidden tile positions using row-shuffle charge accounting', () => {
        const state = run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B')
            ], 2),
            pinnedTileIds: ['a1', 'b1'],
            regionShuffleCharges: 1,
            recallFocus: 2
        });

        const swapped = applyTileSwap(state, 'a1', 'b2');

        expect(swapped).not.toBe(state);
        expect(swapped.regionShuffleCharges).toBe(0);
        expect(swapped.powersUsedThisRun).toBe(true);
        expect(swapped.shuffleUsedThisFloor).toBe(true);
        expect(swapped.shuffleNonce).toBe(1);
        expect(swapped.pinnedTileIds).toEqual([]);
        expect(swapped.recallFocus).toBe(0);
        expect(swapped.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'b2']));
        expect(swapped.stats.shufflesUsed).toBe(1);
        expect(swapped.board!.tiles.map((item) => item.id)).toEqual(['b2', 'a2', 'b1', 'a1']);
    });

    it('normalizes malformed stat blocks before applying tile swap accounting', () => {
        const swapped = applyTileSwap(run({
            stats: Number.NaN as unknown as RunState['stats']
        }), 'a1', 'b2');

        expect(swapped.stats.shufflesUsed).toBe(1);
        expect(swapped.stats.highestLevel).toBe(1);
    });



    it('refuses tile swaps while blocked by state, contract, or target legality', () => {
        const flipped = run({ board: { ...defaultBoard(), flippedTileIds: ['a1'] } });
        expect(applyTileSwap(flipped, 'a1', 'b1')).toBe(flipped);

        const noCharge = run({ regionShuffleCharges: 0 });
        expect(applyTileSwap(noCharge, 'a1', 'b1')).toBe(noCharge);

        const noShuffle = run({ activeContract: { noShuffle: true } as RunState['activeContract'] });
        expect(applyTileSwap(noShuffle, 'a1', 'b1')).toBe(noShuffle);

        const matchedTile = run({ board: board([tile('a1', 'A', 'matched'), tile('b1', 'B')]) });
        expect(applyTileSwap(matchedTile, 'a1', 'b1')).toBe(matchedTile);
    });



    it('does not flash pair outside practice or wild menu runs', () => {
        const state = run({ practiceMode: false, wildMenuRun: false });
        expect(applyFlashPair(state)).toBe(state);
    });

    it('peeks a hidden tile once', () => {
        const state = run({
            board: board([tile('a1', 'A'), tile('a2', 'A'), tile('b1', 'B')]),
            peekCharges: 1,
            recallFocus: 2
        });

        const peeked = applyPeek(state, 'a1');

        expect(peeked.peekCharges).toBe(0);
        expect(peeked.powersUsedThisRun).toBe(true);
        expect(peeked.recallFocus).toBe(1);
        expect(peeked.peekRevealedTileIds).toEqual(['a1']);
        expect(peeked.forgottenTileIdsThisFloor).toEqual(['a1']);
        expect(peeked.board).toBe(state.board);
        expect(applyPeek(peeked, 'a1')).toBe(peeked);
    });

    it('does not peek non-hidden tiles or while a flip is pending', () => {
        const hiddenBlocked = run({ board: { ...defaultBoard(), flippedTileIds: ['a1'] } });
        expect(applyPeek(hiddenBlocked, 'a1')).toBe(hiddenBlocked);

        const matchedTile = run({ board: board([tile('a1', 'A', 'matched'), tile('a2', 'A')]) });
        expect(applyPeek(matchedTile, 'a1')).toBe(matchedTile);
    });



    it('undoes resolving flips and hides the flipped tiles again', () => {
        const resolving = run({
            status: 'resolving',
            board: {
                ...board([
                    tile('a1', 'A', 'flipped'),
                    tile('t1', 'T', 'flipped'),
                    tile('b1', 'B', 'hidden')
                ]),
                flippedTileIds: ['a1', 't1']
            },
            undoUsesThisFloor: 1,
            recallFocus: 2,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: 100,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            }
        });

        const undone = cancelResolvingWithUndo(resolving);

        expect(undone.status).toBe('playing');
        expect(undone.undoUsesThisFloor).toBe(0);
        expect(undone.powersUsedThisRun).toBe(true);
        expect(undone.recallFocus).toBe(1);
        expect(undone.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 't1']));
        expect(undone.board!.flippedTileIds).toEqual([]);
        expect(undone.board!.tiles.find((t) => t.id === 'a1')?.state).toBe('hidden');
        expect(undone.board!.tiles.find((t) => t.id === 't1')?.state).toBe('hidden');
        expect(undone.timerState.resolveRemainingMs).toBeNull();
    });

    it('does not undo when not resolving or no undo use remains', () => {
        const playing = run({ status: 'playing', undoUsesThisFloor: 1 });
        expect(cancelResolvingWithUndo(playing)).toBe(playing);

        const spent = run({ status: 'resolving', undoUsesThisFloor: 0 });
        expect(cancelResolvingWithUndo(spent)).toBe(spent);
    });
});
