import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import {
    getEnemyHazardText,
    getFocusedTileLiveLabel,
    getPickableTileIds,
    getPowerTargetAriaText,
    getTileAriaLabel,
    getTilePosition,
    getTileTraitPreviewText,
    moveFocusInGrid
} from './tileBoardDomAccessibility';

const board: BoardState = {
    level: 1,
    pairCount: 2,
    columns: 2,
    rows: 2,
    matchedPairs: 0,
    flippedTileIds: [],
    floorArchetypeId: null,
    featuredObjectiveId: null,
    tiles: [
        { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
        { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
        { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
        { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
    ]
};

describe('tile board DOM accessibility helpers', () => {
    it('maps tile indexes to one-based grid positions', () => {
        expect(getTilePosition(0, 2)).toEqual({ row: 1, column: 1 });
        expect(getTilePosition(3, 2)).toEqual({ row: 2, column: 2 });
    });

    it('builds hidden and face-up tile labels with route, hazard, scout, and enemy context', () => {
        const labelledBoard: BoardState = {
            ...board,
            enemyHazards: [
                {
                    id: 'enemy-a',
                    kind: 'sentinel',
                    label: 'Sentinel',
                    currentTileId: 'a1',
                    nextTileId: 'b1',
                    pattern: 'patrol',
                    state: 'revealed',
                    damage: 1,
                    hp: 2,
                    maxHp: 3
                }
            ],
            tiles: [
                {
                    ...board.tiles[0]!,
                    state: 'flipped',
                    routeCardKind: 'greed_cache',
                    tileTraitKind: 'volatile',
                    tileHazardKind: 'shuffle_snare',
                    scoutRevealSource: 'omen_seal'
                },
                ...board.tiles.slice(1)
            ]
        };
        const label = getTileAriaLabel(labelledBoard, labelledBoard.tiles[0]!, true, 1, 1);

        expect(label).toContain('Tile A, row 1, column 1');
        expect(label).toContain('Route card: Greed cache.');
        expect(label).toContain('Hazard tile:');
        expect(label).toContain('Trait: Volatile.');
        expect(label).toContain('Scouted by Omen Seal.');
        expect(label).toContain('Occupied by revealed moving enemy patrol Sentinel, 2/3 HP, 1 damage.');
        expect(getEnemyHazardText(labelledBoard, 'b1')).toContain('Next target of moving enemy patrol Sentinel');
    });

    it('does not announce stale moving enemy patrols on cleared boards', () => {
        const clearedBoard: BoardState = {
            ...board,
            matchedPairs: 2,
            enemyHazards: [
                {
                    id: 'stale-warden',
                    kind: 'warden',
                    label: 'Warden',
                    currentTileId: 'a1',
                    nextTileId: 'a2',
                    pattern: 'guard',
                    state: 'revealed',
                    damage: 1,
                    hp: 1,
                    maxHp: 2,
                    bossId: 'trap_warden'
                }
            ],
            tiles: board.tiles.map((tile) => ({ ...tile, state: 'matched' }))
        };

        expect(getEnemyHazardText(clearedBoard, 'a1')).toBe('');
        expect(getEnemyHazardText(clearedBoard, 'a2')).toBe('');
    });

    it('describes board power target validity', () => {
        const hidden = board.tiles[0]!;
        expect(
            getPowerTargetAriaText(hidden, true, new Set(['a1']), false, new Set(), false, new Set(), false, new Set(), null)
        ).toContain(
            'Destroy target: valid'
        );
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), true, new Set(['a1']), false, new Set(), false, new Set(), null)
        ).toContain(
            'Peek target: valid'
        );
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), false, new Set(), true, new Set(['a1']), false, new Set(), null)
        ).toContain(
            'Stray target: valid'
        );
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), false, new Set(), false, new Set(), true, new Set(['a1']), null)
        ).toContain('Swap target: valid');
        expect(
            getPowerTargetAriaText(hidden, false, new Set(), false, new Set(), false, new Set(), true, new Set(['a1']), 'a1')
        ).toContain('Swap origin selected');
    });

    it('announces nearby trait interactions and swap-created trait previews', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                board.tiles[2]!,
                { ...board.tiles[3]!, tileTraitKind: 'heavy' }
            ]
        };

        expect(getTileTraitPreviewText(traitBoard, traitBoard.tiles[0]!)).toContain('Echo + Sealed: combo shard');
        expect(getTileAriaLabel(traitBoard, traitBoard.tiles[0]!, true, 1, 1)).toContain(
            'Nearby trait interaction: Echo + Sealed: combo shard.'
        );
        expect(
            getPowerTargetAriaText(
                traitBoard.tiles[1]!,
                false,
                new Set(),
                false,
                new Set(),
                false,
                new Set(),
                true,
                new Set(['a2']),
                'b1',
                traitBoard
            )
        ).toContain('Swap preview: Sealed + Heavy: score surge.');
    });

    it('collects pickable tiles and moves keyboard focus across available grid slots', () => {
        const blockedBoard: BoardState = {
            ...board,
            tiles: [
                board.tiles[0]!,
                { ...board.tiles[1]!, state: 'removed' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        expect(getPickableTileIds(blockedBoard, true, false)).toEqual(['a1', 'b1', 'b2']);
        expect(moveFocusInGrid(blockedBoard, 'a1', 'right', true, false)).toBe('a1');
        expect(moveFocusInGrid(blockedBoard, 'a1', 'down', true, false)).toBe('b1');
        expect(moveFocusInGrid(blockedBoard, 'b1', 'right', true, false)).toBe('b2');
    });

    it('builds the focused tile live label with power targeting and pair proximity copy', () => {
        const focusedBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1'],
            tiles: [
                { ...board.tiles[0]!, state: 'flipped' },
                board.tiles[1]!,
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        const label = getFocusedTileLiveLabel({
            board: focusedBoard,
            debugPeekActive: false,
            destroyEligibleTileIds: new Set(['a1']),
            destroyPowerVisualActive: true,
            focusedTileId: 'a1',
            pairProximityHintsEnabled: true,
            peekEligibleTileIds: new Set(),
            peekPowerVisualActive: false,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            strayEligibleTileIds: new Set(),
            strayPowerVisualActive: false,
            tileSwapEligibleTileIds: new Set(),
            tileSwapFirstTileId: null,
            tileSwapPowerVisualActive: false
        });

        expect(label).toContain('Tile A, row 1, column 1');
        expect(label).toContain('Destroy target: valid');
        expect(label).toContain('Pair distance: 1 grid steps');
    });

    it('returns an empty focused tile live label when focus is absent or stale', () => {
        expect(
            getFocusedTileLiveLabel({
                board,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: null,
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false
            })
        ).toBe('');
        expect(
            getFocusedTileLiveLabel({
                board,
                debugPeekActive: false,
                destroyEligibleTileIds: new Set(),
                destroyPowerVisualActive: false,
                focusedTileId: 'missing',
                pairProximityHintsEnabled: true,
                peekEligibleTileIds: new Set(),
                peekPowerVisualActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: false,
                runStatus: 'playing',
                strayEligibleTileIds: new Set(),
                strayPowerVisualActive: false,
                tileSwapEligibleTileIds: new Set(),
                tileSwapFirstTileId: null,
                tileSwapPowerVisualActive: false
            })
        ).toBe('');
    });
});
