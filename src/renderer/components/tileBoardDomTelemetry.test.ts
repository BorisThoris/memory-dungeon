import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/tile-identity';
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
                { ...board.tiles[0]!, tileHazardKind: 'shuffle_snare', tileTraitKind: 'echo', routeCardKind: 'greed_cache' },
                { ...board.tiles[1]!, dungeonCardKind: 'trap', dungeonCardState: 'hidden' },
                { ...board.tiles[2]!, dungeonCardKind: 'exit', dungeonExitLockKind: 'iron', state: 'matched' },
                { ...board.tiles[3]!, dungeonCardKind: 'shop' },
                { id: 'c1', pairKey: 'C', symbol: 'C', label: 'C', state: 'removed' }
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
        expect(states).toContain('hidden:3');
        expect(states).toContain('exit:1');
        expect(states).toContain('matched:1');
        expect(states).toContain('objective:3');
        expect(states).toContain('removed:1');
        expect(states).toContain('route:1');
        expect(states).toContain('shop:1');
        expect(states).toContain('trait:1');
        expect(states).toContain('trap-armed:1');
    });

    it('does not report stale moving enemy occupancy after all real pairs are cleared', () => {
        const feedbackBoard: BoardState = {
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

        expect(states).not.toContain('enemy-occupied');
    });

    it('tracks lever and lock feedback states for 3D readability audits', () => {
        const utilityBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, dungeonCardKind: 'lever' },
                { ...board.tiles[1]!, dungeonCardKind: 'lock' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board: utilityBoard,
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(states).toContain('lever:1');
        expect(states).toContain('lock:1');
    });

    it('classifies primary exit metadata as exit instead of raw lock in feedback states', () => {
        const terminalExitBoard: BoardState = {
            ...board,
            pairCount: 1,
            matchedPairs: 1,
            dungeonExitTileId: 'exit',
            dungeonExitLockKind: 'iron',
            dungeonExitActivated: false,
            tiles: [
                { ...board.tiles[0]!, state: 'matched' },
                { ...board.tiles[1]!, state: 'matched' },
                {
                    id: 'exit',
                    pairKey: EXIT_PAIR_KEY,
                    symbol: 'E',
                    label: 'Exit',
                    state: 'hidden',
                    dungeonExitLockKind: 'iron'
                }
            ]
        };

        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board: terminalExitBoard,
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(states).toContain('exit:1');
        expect(states).not.toContain('lock:1');
    });

    it('tracks previewable trait combo opportunities separately from raw trait count', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board: traitBoard,
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(states).toContain('trait:2');
        expect(states).toContain('trait-combo:2');
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
