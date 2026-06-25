import { describe, expect, it } from 'vitest';
import type {
    BoardState,
    RouteSpecialKind,
    Tile
} from './contracts';
import {
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    isCompletionSafeStrayPairKey,
    tileIsDestroyEligiblePreview,
    tileIsPeekEligiblePreview,
    tileIsStrayEligiblePreview
} from './board-power-targeting';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
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

const board = (tiles: Tile[]): BoardState => ({
    level: 1,
    pairCount: 0,
    columns: 4,
    rows: 2,
    tiles,
    flippedTileIds: [],
    matchedPairs: 0,
    floorArchetypeId: null,
    featuredObjectiveId: null
});

describe('board power targeting rules', () => {
    it('collects only fully hidden non-decoy pairs for destroy targeting', () => {
        const state = board([
            tile('a1', 'A'),
            tile('a2', 'A'),
            tile('b1', 'B'),
            tile('b2', 'B', 'matched'),
            tile('d1', DECOY_PAIR_KEY)
        ]);

        expect(tileIsDestroyEligiblePreview(state, 'a1')).toBe(true);
        expect(tileIsDestroyEligiblePreview(state, 'b1')).toBe(false);
        expect(tileIsDestroyEligiblePreview(state, 'd1')).toBe(false);
        expect(collectDestroyEligibleTileIds(state)).toEqual(new Set(['a1', 'a2']));
    });

    it('allows destroy on redundant key and lever sources while protecting the last exit source', () => {
        const keyBoard = {
            ...board([
                { ...tile('key-a', 'key-a'), dungeonCardKind: 'key' as const, dungeonKeyKind: 'iron' as const },
                { ...tile('key-b', 'key-a'), dungeonCardKind: 'key' as const, dungeonKeyKind: 'iron' as const },
                { ...tile('spare-key-a', 'key-b'), dungeonCardKind: 'key' as const, dungeonKeyKind: 'iron' as const },
                { ...tile('spare-key-b', 'key-b'), dungeonCardKind: 'key' as const, dungeonKeyKind: 'iron' as const },
                { ...tile('exit', EXIT_PAIR_KEY), dungeonCardKind: 'exit' as const, dungeonExitLockKind: 'iron' as const }
            ]),
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron' as const
        };
        const leverBoard = {
            ...board([
                { ...tile('lever-a', 'lever-a'), dungeonCardKind: 'lever' as const, dungeonCardEffectId: 'lever_floor' as const },
                { ...tile('lever-b', 'lever-a'), dungeonCardKind: 'lever' as const, dungeonCardEffectId: 'lever_floor' as const },
                { ...tile('spare-lever-a', 'lever-b'), dungeonCardKind: 'lever' as const, dungeonCardEffectId: 'lever_floor' as const },
                { ...tile('spare-lever-b', 'lever-b'), dungeonCardKind: 'lever' as const, dungeonCardEffectId: 'lever_floor' as const },
                { ...tile('exit', EXIT_PAIR_KEY), dungeonCardKind: 'exit' as const, dungeonExitLockKind: 'lever' as const, dungeonExitRequiredLeverCount: 1 }
            ]),
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'lever' as const,
            dungeonExitRequiredLeverCount: 1
        };

        expect(tileIsDestroyEligiblePreview(keyBoard, 'key-a')).toBe(true);
        expect(tileIsDestroyEligiblePreview({
            ...keyBoard,
            tiles: keyBoard.tiles.filter((candidate) => candidate.pairKey !== 'key-b')
        }, 'key-a')).toBe(false);
        expect(tileIsDestroyEligiblePreview(leverBoard, 'lever-a')).toBe(true);
        expect(tileIsDestroyEligiblePreview({
            ...leverBoard,
            tiles: leverBoard.tiles.filter((candidate) => candidate.pairKey !== 'lever-b')
        }, 'lever-a')).toBe(false);
    });

    it('allows peek targeting hidden tiles that have not already been revealed by peek', () => {
        const state = board([
            tile('a1', 'A'),
            tile('a2', 'A', 'flipped'),
            tile('w1', WILD_PAIR_KEY)
        ]);

        expect(tileIsPeekEligiblePreview(state, ['w1'], 'a1')).toBe(true);
        expect(tileIsPeekEligiblePreview(state, [], 'a2')).toBe(false);
        expect(tileIsPeekEligiblePreview(state, ['w1'], 'w1')).toBe(false);
        expect(collectPeekEligibleTileIds(state, ['w1'])).toEqual(new Set(['a1']));
    });

    it('limits stray targeting to hidden completion-safe singleton tiles', () => {
        const state = board([
            tile('a1', 'A'),
            tile('w1', WILD_PAIR_KEY),
            tile('shop1', SHOP_PAIR_KEY),
            tile('room1', ROOM_PAIR_KEY),
            tile('d1', DECOY_PAIR_KEY),
            tile('matchedWild', WILD_PAIR_KEY, 'matched')
        ]);

        expect(isCompletionSafeStrayPairKey(WILD_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey(SHOP_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey(ROOM_PAIR_KEY)).toBe(true);
        expect(isCompletionSafeStrayPairKey('A')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'w1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'shop1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'room1')).toBe(true);
        expect(tileIsStrayEligiblePreview(state, 'a1')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'd1')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'matchedWild')).toBe(false);
    });

    it('protects route specials that are unsafe to remove as stray tiles', () => {
        const state = board([
            tile('keystone', WILD_PAIR_KEY, 'hidden', 'keystone_pair'),
            tile('ward', WILD_PAIR_KEY, 'hidden', 'final_ward'),
            tile('omen', WILD_PAIR_KEY, 'hidden', 'omen_seal'),
            tile('secret', WILD_PAIR_KEY, 'hidden', 'secret_door')
        ]);

        expect(tileIsStrayEligiblePreview(state, 'keystone')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'ward')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'omen')).toBe(false);
        expect(tileIsStrayEligiblePreview(state, 'secret')).toBe(true);
    });
});
