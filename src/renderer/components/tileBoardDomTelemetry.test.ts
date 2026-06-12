import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import {
    getCardFeedbackStatesAttr,
    getDevE2ePairPositionsJson,
    getHiddenSlotsAttr,
    getHiddenTileCount,
    getHiddenTrapSlotsAttr,
    getPickableHiddenSlotsAttr,
    getResolvedTrapSlotsAttr,
    getResolvedTrapTileCount
} from './tileBoardDomTelemetry';

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

describe('tile board DOM telemetry helpers', () => {
    it('summarizes hidden and trap slot attributes', () => {
        const trapBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, dungeonCardKind: 'trap', dungeonCardState: 'hidden' },
                { ...board.tiles[1]!, dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
                { ...board.tiles[2]!, state: 'matched' },
                board.tiles[3]!
            ]
        };

        expect(getHiddenTileCount(trapBoard)).toBe(3);
        expect(getHiddenSlotsAttr(trapBoard)).toBe('1,1;1,2;2,2');
        expect(getHiddenTrapSlotsAttr(trapBoard, true)).toBe('1,1');
        expect(getHiddenTrapSlotsAttr(trapBoard, false)).toBeUndefined();
        expect(getResolvedTrapSlotsAttr(trapBoard)).toBe('1,2');
        expect(getResolvedTrapTileCount(trapBoard)).toBe(1);
    });

    it('emits dev-only pickable hidden slots', () => {
        expect(getPickableHiddenSlotsAttr({
            allowGambitThirdFlip: false,
            board,
            includeDevAttributes: true,
            interactive: true
        })).toBe('1,1;1,2;2,1;2,2');
        expect(getPickableHiddenSlotsAttr({
            allowGambitThirdFlip: false,
            board,
            includeDevAttributes: false,
            interactive: true
        })).toBeUndefined();
    });

    it('summarizes card feedback states in stable sorted order', () => {
        const feedbackBoard: BoardState = {
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
                    hp: 1,
                    maxHp: 1
                }
            ],
            tiles: [
                { ...board.tiles[0]!, tileHazardKind: 'shuffle_snare', routeCardKind: 'greed_cache' },
                { ...board.tiles[1]!, dungeonCardKind: 'trap', dungeonCardState: 'hidden' },
                { ...board.tiles[2]!, state: 'matched' },
                { ...board.tiles[3]!, state: 'removed' }
            ]
        };

        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board: feedbackBoard,
            boardApplicationFocused: true,
            debugPeekActive: false,
            focusedTileId: 'a1',
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(states).toContain('enemy-occupied:1');
        expect(states).toContain('focused:1');
        expect(states).toContain('hazard:1');
        expect(states).toContain('hidden:2');
        expect(states).toContain('matched:1');
        expect(states).toContain('objective:1');
        expect(states).toContain('removed:1');
        expect(states).toContain('route:1');
        expect(states).toContain('trap-armed:1');
    });

    it('serializes dev pair positions only when enough pairs are available', () => {
        expect(getDevE2ePairPositionsJson(board, false)).toBeUndefined();

        const parsed = JSON.parse(getDevE2ePairPositionsJson(board, true) ?? '{}') as Record<
            string,
            { row: number; col: number }[]
        >;
        expect(parsed).toEqual({
            A: [
                { row: 1, col: 1 },
                { row: 1, col: 2 }
            ],
            B: [
                { row: 2, col: 1 },
                { row: 2, col: 2 }
            ]
        });
    });
});
