import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RouteSpecialKind,
    RunState,
    Tile
} from './contracts';
import {
    applyDestroyPairTransition,
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    applyTileSwap,
    cancelResolvingWithUndo
} from './board-power-actions';
import {
    DECOY_PAIR_KEY,
    ROOM_PAIR_KEY,
    WILD_PAIR_KEY
} from './tile-identity';

const tile = (
    id: string,
    pairKey: string,
    state: Tile['state'] = 'hidden',
    routeSpecialKind?: RouteSpecialKind
): Tile => ({
    id,
    pairKey,
    symbol: id,
    label: id,
    state,
    routeSpecialKind
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
    destroyPairCharges: 1,
    freeShuffleThisFloor: false,
    regionShuffleCharges: 1,
    regionShuffleFreeThisFloor: false,
    flashPairCharges: 1,
    peekCharges: 1,
    strayRemoveCharges: 1,
    strayRemoveArmed: true,
    practiceMode: true,
    wildMenuRun: false,
    weakerShuffleMode: null,
    shuffleScoreTaxActive: false,
    matchScoreMultiplier: 1,
    relicIds: [],
    activeMutators: [],
    pinnedTileIds: ['a1'],
    forgottenTileIdsThisFloor: [],
    peekRevealedTileIds: [],
    flashPairRevealedTileIds: [],
    powersUsedThisRun: false,
    shuffleUsedThisFloor: false,
    destroyUsedThisFloor: false,
    parasiteFloors: 2,
    recallFocus: 2,
    stats: {
        shufflesUsed: 0,
        matchesFound: 0,
        pairsDestroyed: 0
    },
    ...overrides
} as RunState);

describe('board power actions', () => {
    it('applies destroy-pair transition accounting without finalizing the level', () => {
        const state = run({
            board: board([
                {
                    ...tile('a1', 'A'),
                    routeCardKind: 'greed_cache',
                    routeSpecialKind: 'mimic_cache',
                    routeSpecialRevealed: true,
                    routeSpecialRevealSource: 'peek',
                    lanternScouted: true,
                    scoutRevealSource: 'lantern_ward'
                },
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B')
            ]),
            pinnedTileIds: ['a1', 'b1'],
            activeMutators: ['score_parasite'],
            parasiteFloors: 3,
            recallFocus: 2
        });

        const result = applyDestroyPairTransition(state, 'a1', {
            isBoardComplete: () => false,
            rotateShiftingSpotlight: (_run, rotatedBoard) => ({
                board: { ...rotatedBoard, wardPairKey: 'B', bountyPairKey: 'C' },
                shiftingSpotlightNonce: 4
            })
        });

        expect(result.changed).toBe(true);
        expect(result.boardComplete).toBe(false);
        expect(result.run.destroyPairCharges).toBe(0);
        expect(result.run.destroyUsedThisFloor).toBe(true);
        expect(result.run.powersUsedThisRun).toBe(true);
        expect(result.run.pinnedTileIds).toEqual(['b1']);
        expect(result.run.recallFocus).toBe(1);
        expect(result.run.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'a2']));
        expect(result.run.parasiteFloors).toBe(0);
        expect(result.run.stats.matchesFound).toBe(1);
        expect(result.run.stats.pairsDestroyed).toBe(1);
        expect(result.run.shiftingSpotlightNonce).toBe(4);
        expect(result.run.board!.matchedPairs).toBe(1);
        const destroyedTile = result.run.board!.tiles.find((t) => t.id === 'a1')!;
        expect(destroyedTile.state).toBe('matched');
        expect(destroyedTile.routeCardKind).toBeUndefined();
        expect(destroyedTile.routeSpecialKind).toBeUndefined();
        expect(destroyedTile.lanternScouted).toBeUndefined();
    });

    it('returns an unchanged destroy transition when run rules refuse the target', () => {
        const noDestroy = run({ activeContract: { noDestroy: true } as RunState['activeContract'] });
        expect(applyDestroyPairTransition(noDestroy, 'a1', {
            isBoardComplete: () => false,
            rotateShiftingSpotlight: (_run, rotatedBoard) => ({ board: rotatedBoard, shiftingSpotlightNonce: 0 })
        })).toEqual({ run: noDestroy, boardComplete: false, changed: false });

        const noCharge = run({ destroyPairCharges: 0 });
        expect(applyDestroyPairTransition(noCharge, 'a1', {
            isBoardComplete: () => false,
            rotateShiftingSpotlight: (_run, rotatedBoard) => ({ board: rotatedBoard, shiftingSpotlightNonce: 0 })
        })).toEqual({ run: noCharge, boardComplete: false, changed: false });
    });

    it('reports board completion from the supplied completion rule', () => {
        const result = applyDestroyPairTransition(run(), 'a1', {
            isBoardComplete: () => true,
            rotateShiftingSpotlight: (_run, rotatedBoard) => ({ board: rotatedBoard, shiftingSpotlightNonce: 0 })
        });

        expect(result.changed).toBe(true);
        expect(result.boardComplete).toBe(true);
    });

    it('normalizes fractional destroy charges and malformed destroy stats before spending', () => {
        const state = run({
            destroyPairCharges: 1.8,
            board: { ...defaultBoard(), matchedPairs: Number.NaN },
            parasiteFloors: Number.POSITIVE_INFINITY
        });
        const result = applyDestroyPairTransition({
            ...state,
            stats: {
                ...state.stats,
                matchesFound: Number.NaN,
                pairsDestroyed: Number.POSITIVE_INFINITY
            }
        }, 'a1', {
            isBoardComplete: () => false,
            rotateShiftingSpotlight: (_run, rotatedBoard) => ({ board: rotatedBoard, shiftingSpotlightNonce: 0 })
        });

        expect(result.changed).toBe(true);
        expect(result.run.destroyPairCharges).toBe(0);
        expect(result.run.stats.matchesFound).toBe(1);
        expect(result.run.stats.pairsDestroyed).toBe(1);
        expect(result.run.board!.matchedPairs).toBe(1);
        expect(result.run.parasiteFloors).toBe(0);
    });

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

    it('uses the first-shuffle relic free charge before spending normal charges', () => {
        const shuffled = applyShuffle(run({
            shuffleCharges: 1,
            freeShuffleThisFloor: true,
            relicIds: ['first_shuffle_free_per_floor']
        }));

        expect(shuffled.shuffleCharges).toBe(1);
        expect(shuffled.freeShuffleThisFloor).toBe(false);
    });

    it('applies row shuffle only to rows with at least two hidden tiles', () => {
        const state = run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('b1', 'B'),
                tile('b2', 'B', 'matched')
            ], 2),
            regionShuffleRowArmed: 0
        });

        const wrongRow = applyRegionShuffle(state, 1);
        expect(wrongRow).toBe(state);

        const shuffled = applyRegionShuffle(state, 0);
        expect(shuffled).not.toBe(state);
        expect(shuffled.regionShuffleCharges).toBe(0);
        expect(shuffled.regionShuffleRowArmed).toBeNull();
        expect(shuffled.pinnedTileIds).toEqual([]);
        expect(shuffled.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'a2']));
        expect(shuffled.stats.shufflesUsed).toBe(1);
        expect(shuffled.board!.tiles[2]?.id).toBe('b1');
        expect(shuffled.board!.tiles[3]?.id).toBe('b2');
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
        expect(swapped.regionShuffleRowArmed).toBeNull();
        expect(swapped.powersUsedThisRun).toBe(true);
        expect(swapped.shuffleUsedThisFloor).toBe(true);
        expect(swapped.shuffleNonce).toBe(1);
        expect(swapped.pinnedTileIds).toEqual([]);
        expect(swapped.recallFocus).toBe(0);
        expect(swapped.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'b2']));
        expect(swapped.stats.shufflesUsed).toBe(1);
        expect(swapped.board!.tiles.map((item) => item.id)).toEqual(['b2', 'a2', 'b1', 'a1']);
    });

    it('uses the free row-shuffle relic charge for tile swaps before spending normal charges', () => {
        const swapped = applyTileSwap(run({
            regionShuffleCharges: 1,
            regionShuffleFreeThisFloor: true,
            relicIds: ['region_shuffle_free_first']
        }), 'a1', 'b1');

        expect(swapped.regionShuffleCharges).toBe(1);
        expect(swapped.regionShuffleFreeThisFloor).toBe(false);
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

    it('reveals a deterministic hidden non-decoy pair for flash pair', () => {
        const flashed = applyFlashPair(run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A'),
                tile('d1', DECOY_PAIR_KEY)
            ]),
            flashPairCharges: 1
        }));

        expect(flashed.flashPairCharges).toBe(0);
        expect(flashed.powersUsedThisRun).toBe(true);
        expect(flashed.shuffleNonce).toBe(1);
        expect(flashed.flashPairRevealedTileIds).toEqual(['a1', 'a2']);
    });

    it('normalizes fractional direct power charges before spending', () => {
        const undoBoard = defaultBoard();
        const flashed = applyFlashPair(run({
            board: board([
                tile('a1', 'A'),
                tile('a2', 'A')
            ]),
            flashPairCharges: 1.8,
            shuffleNonce: Number.NaN
        }));
        const peeked = applyPeek(run({ peekCharges: 1.8 }), 'a1');
        const removed = applyStrayRemove(run({
            board: board([
                tile('w1', WILD_PAIR_KEY),
                tile('a1', 'A')
            ]),
            strayRemoveCharges: 1.8,
            strayRemoveArmed: true
        }), 'w1');
        const undone = cancelResolvingWithUndo(run({
            status: 'resolving',
            board: {
                ...undoBoard,
                flippedTileIds: ['a1'],
                tiles: undoBoard.tiles.map((t) => (t.id === 'a1' ? { ...t, state: 'flipped' } : t))
            },
            undoUsesThisFloor: 1.8,
            timerState: {
                memorizeRemainingMs: null,
                resolveRemainingMs: 100,
                debugRevealRemainingMs: null,
                pausedFromStatus: null
            }
        }));

        expect(flashed.flashPairCharges).toBe(0);
        expect(flashed.shuffleNonce).toBe(1);
        expect(peeked.peekCharges).toBe(0);
        expect(removed.strayRemoveCharges).toBe(0);
        expect(undone.undoUsesThisFloor).toBe(0);
    });

    it('fails closed when direct power action open-flip state is malformed', () => {
        const malformedBoard = {
            ...defaultBoard(),
            flippedTileIds: Number.NaN as unknown as string[]
        };
        const malformed = run({ board: malformedBoard });

        expect(applyShuffle(malformed)).toBe(malformed);
        expect(applyRegionShuffle(malformed, 0)).toBe(malformed);
        expect(applyTileSwap(malformed, 'a1', 'b1')).toBe(malformed);
        expect(applyFlashPair(malformed)).toBe(malformed);
        expect(applyPeek(malformed, 'a1')).toBe(malformed);
        expect(applyStrayRemove(malformed, 'a1')).toBe(malformed);
        expect(applyDestroyPairTransition(malformed, 'a1', {
            isBoardComplete: () => false,
            rotateShiftingSpotlight: (_run, rotatedBoard) => ({ board: rotatedBoard, shiftingSpotlightNonce: 0 })
        })).toEqual({ run: malformed, boardComplete: false, changed: false });

        const resolving = run({
            status: 'resolving',
            board: malformedBoard,
            undoUsesThisFloor: 1
        });
        expect(cancelResolvingWithUndo(resolving)).toBe(resolving);
    });

    it('does not flash pair outside practice or wild menu runs', () => {
        const state = run({ practiceMode: false, wildMenuRun: false });
        expect(applyFlashPair(state)).toBe(state);
    });

    it('peeks hidden tiles once and reveals eligible route specials across the pair', () => {
        const state = run({
            board: board([
                tile('a1', 'A', 'hidden', 'secret_door'),
                tile('a2', 'A', 'hidden', 'secret_door'),
                tile('b1', 'B')
            ]),
            peekCharges: 1,
            recallFocus: 2
        });

        const peeked = applyPeek(state, 'a1');

        expect(peeked.peekCharges).toBe(0);
        expect(peeked.powersUsedThisRun).toBe(true);
        expect(peeked.recallFocus).toBe(1);
        expect(peeked.peekRevealedTileIds).toEqual(['a1']);
        expect(peeked.forgottenTileIdsThisFloor).toEqual(['a1']);
        expect(peeked.board!.tiles.filter((t) => t.pairKey === 'A').every((t) => t.routeSpecialRevealed)).toBe(true);
        expect(applyPeek(peeked, 'a1')).toBe(peeked);
    });

    it('does not peek non-hidden tiles or while a flip is pending', () => {
        const hiddenBlocked = run({ board: { ...defaultBoard(), flippedTileIds: ['a1'] } });
        expect(applyPeek(hiddenBlocked, 'a1')).toBe(hiddenBlocked);

        const matchedTile = run({ board: board([tile('a1', 'A', 'matched'), tile('a2', 'A')]) });
        expect(applyPeek(matchedTile, 'a1')).toBe(matchedTile);
    });

    it('removes completion-safe stray tiles and clears route metadata from the singleton pair', () => {
        const state = run({
            board: board([
                tile('w1', WILD_PAIR_KEY, 'hidden', 'secret_door'),
                tile('room1', ROOM_PAIR_KEY, 'hidden', 'secret_door'),
                tile('a1', 'A')
            ]),
            strayRemoveCharges: 1,
            strayRemoveArmed: true,
            recallFocus: 2
        });

        const removed = applyStrayRemove(state, 'w1');

        expect(removed.strayRemoveCharges).toBe(0);
        expect(removed.strayRemoveArmed).toBe(false);
        expect(removed.powersUsedThisRun).toBe(true);
        expect(removed.recallFocus).toBe(1);
        expect(removed.forgottenTileIdsThisFloor).toEqual(['w1']);
        const removedTile = removed.board!.tiles.find((t) => t.id === 'w1')!;
        expect(removedTile.state).toBe('removed');
        expect(removedTile.routeSpecialKind).toBeUndefined();
    });

    it('refuses stray removal for normal pair tiles and protected route specials', () => {
        const normalPair = run({ board: board([tile('a1', 'A'), tile('a2', 'A')]) });
        expect(applyStrayRemove(normalPair, 'a1')).toBe(normalPair);

        const protectedSpecial = run({
            board: board([tile('w1', WILD_PAIR_KEY, 'hidden', 'final_ward')])
        });
        expect(applyStrayRemove(protectedSpecial, 'w1')).toBe(protectedSpecial);
    });

    it('undoes resolving flips while preserving resolved trap cards face-up', () => {
        const resolving = run({
            status: 'resolving',
            board: {
                ...board([
                    tile('a1', 'A', 'flipped'),
                    {
                        ...tile('trap1', 'T', 'flipped'),
                        dungeonCardKind: 'trap' as const,
                        dungeonCardState: 'resolved' as const
                    },
                    tile('b1', 'B', 'hidden')
                ]),
                flippedTileIds: ['a1', 'trap1']
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
        expect(undone.forgottenTileIdsThisFloor).toEqual(expect.arrayContaining(['a1', 'trap1']));
        expect(undone.board!.flippedTileIds).toEqual([]);
        expect(undone.board!.tiles.find((t) => t.id === 'a1')?.state).toBe('hidden');
        expect(undone.board!.tiles.find((t) => t.id === 'trap1')?.state).toBe('flipped');
        expect(undone.timerState.resolveRemainingMs).toBeNull();
    });

    it('does not undo when not resolving or no undo use remains', () => {
        const playing = run({ status: 'playing', undoUsesThisFloor: 1 });
        expect(cancelResolvingWithUndo(playing)).toBe(playing);

        const spent = run({ status: 'resolving', undoUsesThisFloor: 0 });
        expect(cancelResolvingWithUndo(spent)).toBe(spent);
    });
});
