import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { buildTileBoardSceneModel } from './tileBoardSceneModel';

const tile = (id: string, pairKey: string, state: Tile['state'] = 'hidden'): Tile => ({
    id,
    label: id,
    pairKey,
    state,
    symbol: id
});

const board = (tiles: Tile[], overrides: Partial<BoardState> = {}): BoardState =>
    ({
        columns: 2,
        featuredObjectiveId: null,
        flippedTileIds: [],
        floorArchetypeId: null,
        level: 1,
        matchedPairs: 0,
        pairCount: Math.floor(tiles.length / 2),
        rows: Math.ceil(tiles.length / 2),
        tiles,
        ...overrides
    }) as BoardState;

const model = (input: Partial<Parameters<typeof buildTileBoardSceneModel>[0]> = {}) => {
    const b = input.board ?? board([tile('a1', 'a'), tile('a2', 'a')]);

    return buildTileBoardSceneModel({
        allowGambitThirdFlip: false,
        board: b,
        bountyPairKey: null,
        cardHeight: 1.4,
        cardWidth: 1,
        compact: false,
        cursedPairKey: null,
        debugPeekActive: false,
        destroyEligibleTileIds: new Set(),
        destroyPowerVisualActive: false,
        dimmedTileIds: undefined,
        interactionSuppressed: false,
        interactive: true,
        nBackAnchorPairKey: null,
        nBackMutatorActive: false,
        pairProximityHintsEnabled: true,
        peekEligibleTileIds: new Set(),
        peekPowerVisualActive: false,
        peekRevealedTileIds: [],
        pinModeBoardHintActive: false,
        pinnedTileIds: [],
        previewActive: false,
        reduceMotion: true,
        runStatus: 'playing',
        shiftingSpotlightActive: false,
        showTutorialPairMarkers: true,
        silhouetteDuringPlay: false,
        strayEligibleTileIds: new Set(),
        strayPowerVisualActive: false,
        stickyBlockedTileId: null,
        tileSpacing: 1.35,
        wardPairKey: null,
        wideRecallInPlay: false,
        ...input
    });
};

describe('tileBoardSceneModel', () => {
    it('builds rows from scene arrays and computes rune-field metrics', () => {
        const result = model({
            board: board([tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b')]),
            peekRevealedTileIds: ['b1'],
            pinnedTileIds: ['a2']
        });

        expect(result.tileBezelRows.map((row) => row.faceUp)).toEqual([false, false, true]);
        expect(result.tileBezelRows.map((row) => row.isPinned)).toEqual([false, true, false]);
        expect(result.boardRuneFieldMetrics.width).toBeGreaterThan(1);
        expect(result.boardRuneFieldMetrics.height).toBeGreaterThan(1.4);
    });

    it('derives flip lock for overlay prewarm demand keys', () => {
        const result = model({
            board: board([tile('a1', 'a'), tile('a2', 'a'), tile('b1', 'b'), tile('b2', 'b')], {
                flippedTileIds: ['a1', 'b1']
            })
        });

        expect(result.flipLocked).toBe(true);
        expect(result.overlayPrewarmDemandPairKeys).toEqual([]);
    });

    it('maps active enemy hazards to current and next row transforms', () => {
        const result = model({
            board: board([tile('a1', 'a'), tile('b1', 'b')], {
                enemyHazards: [
                    {
                        currentTileId: 'a1',
                        damage: 1,
                        hp: 1,
                        id: 'hazard',
                        kind: 'stalker',
                        label: 'Stalker',
                        maxHp: 1,
                        nextTileId: 'b1',
                        pattern: 'stalk',
                        state: 'revealed'
                    },
                    {
                        currentTileId: 'missing',
                        damage: 1,
                        hp: 1,
                        id: 'missing',
                        kind: 'sentinel',
                        label: 'Sentinel',
                        maxHp: 1,
                        nextTileId: 'b1',
                        pattern: 'guard',
                        state: 'revealed'
                    }
                ]
            })
        });

        expect(result.enemyHazardRows).toHaveLength(1);
        expect(result.enemyHazardRows[0]!.hazard.id).toBe('hazard');
        expect(result.enemyHazardRows[0]!.nextTransform).not.toBeNull();
    });
});
