import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import {
    CARD_FEEDBACK_BEAT_TIER_CONTRACT,
    CARD_FEEDBACK_CADENCE_CONTRACT,
    getCardFeedbackActionCuesAttr,
    getCardFeedbackActionPriorityAttr,
    getCardFeedbackBeatCountsAttr,
    getCardFeedbackBeatTiersAttr,
    getCardFeedbackCadencesAttr,
    getCardFeedbackMarkerShapesAttr,
    getCardFeedbackPrimaryActionAttr,
    getCardFeedbackVisibleTraitPreviewCount,
    getCardFeedbackRouteGlyphsAttr,
    getCardFeedbackStatesAttr,
    getCardFeedbackTraitLaneBeatsAttr,
    getCardFeedbackTraitLaneActionsAttr,
    getCardFeedbackTraitLaneCuesAttr,
    getCardFeedbackTraitLanePrimaryActionAttr,
    getCardFeedbackTraitRouteIntensitiesAttr,
    getCardFeedbackTraitRouteTiersAttr,
    getDevE2ePairPositionsJson,
    getHiddenSlotsAttr,
    getHiddenTileCount,
    getPickableHiddenSlotsAttr
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
    it('exports a stable card feedback beat tier contract', () => {
        expect(CARD_FEEDBACK_BEAT_TIER_CONTRACT).toBe('cashout surge follow-up route setup');
    });

    it('exports a stable card feedback cadence contract', () => {
        expect(CARD_FEEDBACK_CADENCE_CONTRACT).toBe('cashout surge follow-up route prime');
    });

    it('summarizes hidden slot attributes', () => {
        const partlyMatchedBoard: BoardState = {
            ...board,
            tiles: [board.tiles[0]!, board.tiles[1]!, { ...board.tiles[2]!, state: 'matched' }, board.tiles[3]!]
        };

        expect(getHiddenTileCount(partlyMatchedBoard)).toBe(3);
        expect(getHiddenSlotsAttr(partlyMatchedBoard)).toBe('1,1;1,2;2,2');
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
            tiles: [
                { ...board.tiles[0]!, tileTraitKind: 'echo' },
                { ...board.tiles[1]!, findableKind: 'score_glint' },
                { ...board.tiles[2]!, state: 'matched' },
                board.tiles[3]!,
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

        expect(states).toContain('findable:1');
        expect(states).toContain('focused:1');
        expect(states).toContain('hidden:3');
        expect(states).toContain('matched:1');
        expect(states).toContain('removed:1');
        expect(states).toContain('trait:1');
    });

    it('tracks previewable trait combo opportunities separately from raw trait count', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'conduit', tileTraitKind: 'conduit' },
                { ...board.tiles[1]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[2]!, pairKey: 'stasis', tileTraitKind: 'stasis' },
                { ...board.tiles[3]!, pairKey: 'relay', tileTraitKind: 'conduit' }
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

        expect(states).toContain('trait:4');
        expect(states).toContain('chain-ready:4');
        expect(states).toContain('trait-combo:4');
        expect(states).toContain('trait-combo-surge:4');
        expect(getCardFeedbackMarkerShapesAttr({ board: traitBoard })).toBe('combo-surge:4;linked-route:4');
        // Two Conduits, each beside the Echo and the Stasis: a peek spark, a score charge and a lock
        // pulse apiece, so every lane counts two cards.
        expect(getCardFeedbackTraitLaneCuesAttr(traitBoard)).toBe('tool:2>block:2');
        expect(getCardFeedbackTraitLanePrimaryActionAttr(traitBoard)).toBe('tool:Use tool:2');
        expect(getCardFeedbackTraitLaneBeatsAttr(traitBoard)).toBe('tool:3>block:4');
        expect(getCardFeedbackTraitLaneActionsAttr(traitBoard)).toBe(
            'tool:Use tool:2>block:Deny match:2'
        );
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board: traitBoard })).toBe('surge:4');
        expect(getCardFeedbackTraitRouteTiersAttr({ board: traitBoard })).toBe('surge:4');
        expect(getCardFeedbackCadencesAttr({ board: traitBoard })).toBe('surge:Route surge:4');
    });

    it('counts visible trait preview cards when the board exposes combo interactions', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'conduit', tileTraitKind: 'conduit' },
                { ...board.tiles[1]!, pairKey: 'heavy', tileTraitKind: 'heavy' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        expect(
            getCardFeedbackVisibleTraitPreviewCount({
                board: traitBoard,
                debugPeekActive: false,
                peekRevealedTileIds: new Set(),
                previewActive: true
            })
        ).toBe(1);
    });

    it('summarizes actionable trait lane cues by payoff type', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'conduit', tileTraitKind: 'conduit' },
                { ...board.tiles[1]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[2]!, pairKey: 'stasis', tileTraitKind: 'stasis' },
                { ...board.tiles[3]!, pairKey: 'relay', tileTraitKind: 'conduit' }
            ]
        };

        // Two Conduits, each beside the Echo and the Stasis: a peek spark, a score charge and a lock
        // pulse apiece, so every lane counts two cards.
        expect(getCardFeedbackTraitLaneCuesAttr(traitBoard)).toBe('tool:2>block:2');
        expect(getCardFeedbackTraitLanePrimaryActionAttr(traitBoard)).toBe('tool:Use tool:2');
        expect(getCardFeedbackTraitLaneBeatsAttr(traitBoard)).toBe('tool:3>block:4');
        expect(getCardFeedbackTraitLaneActionsAttr(traitBoard)).toBe(
            'tool:Use tool:2>block:Deny match:2'
        );
    });

    it('tracks multi-route trait combo surge cards separately from ordinary combo-ready cards', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'conduit', tileTraitKind: 'conduit' },
                { ...board.tiles[1]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[2]!, pairKey: 'stasis', tileTraitKind: 'stasis' },
                { ...board.tiles[3]!, pairKey: 'relay', tileTraitKind: 'conduit' }
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

        expect(states).toContain('chain-ready:4');
        expect(states).toContain('chain-surge:4');
        expect(states).toContain('trait-combo:4');
        expect(states).toContain('trait-combo-surge:4');
        expect(getCardFeedbackMarkerShapesAttr({ board: traitBoard })).toBe('combo-surge:4;linked-route:4');
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board: traitBoard })).toBe('surge:4');
        expect(getCardFeedbackTraitRouteTiersAttr({ board: traitBoard })).toBe('surge:4');
        expect(getCardFeedbackCadencesAttr({ board: traitBoard })).toBe('surge:Route surge:4');
    });

    it('tracks chain reward hot cards separately from generic trait combo opportunities', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'conduit', tileTraitKind: 'conduit' },
                { ...board.tiles[1]!, pairKey: 'heavy', tileTraitKind: 'heavy' },
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
            runStatus: 'playing',
            traitRewardHotTileIds: ['a1', 'a2']
        });

        expect(states).toContain('chain-ready:2');
        expect(states).toContain('chain-reward-hot:2');
        expect(states).toContain('trait-payoff-stack:2');
        expect(getCardFeedbackMarkerShapesAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'linked-route:2;payoff-bar:2;payoff-stack:2'
        );
        expect(getCardFeedbackActionCuesAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'cash-now:2'
        );
        expect(getCardFeedbackActionPriorityAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'cash-now:2'
        );
        expect(getCardFeedbackPrimaryActionAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'cash-now'
        );
        expect(getCardFeedbackBeatTiersAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'cashout:2'
        );
        expect(getCardFeedbackBeatCountsAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            '5:2'
        );
        expect(getCardFeedbackTraitRouteTiersAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'payoff-stack:2'
        );
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'stack:2'
        );
        expect(getCardFeedbackRouteGlyphsAttr({ board: traitBoard, traitRewardHotTileIds: ['a1', 'a2'] })).toBe(
            'payoff-stack:2'
        );
    });

    it('tracks swap-route setup targets separately from active chain cards', () => {
        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board,
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            traitRouteTargetTileIds: ['a1', 'b2']
        });

        expect(states).toContain('chain-setup:2');
        expect(states).toContain('trait-route-target:2');
        expect(getCardFeedbackMarkerShapesAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe(
            'swap-target-crossbar:2'
        );
        expect(getCardFeedbackActionCuesAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe(
            'route-setup:2'
        );
        expect(getCardFeedbackBeatTiersAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe('setup:2');
        expect(getCardFeedbackBeatCountsAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe('2:2');
        expect(getCardFeedbackTraitRouteTiersAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe(
            'route-target:2'
        );
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe(
            'setup:2'
        );
        expect(getCardFeedbackRouteGlyphsAttr({ board, traitRouteTargetTileIds: ['a1', 'b2'] })).toBe(
            'prime-cross:2'
        );
    });

    it('tracks selected trait followup mates separately from generic chain-ready cards', () => {
        const selectedBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1'],
            tiles: [
                { ...board.tiles[0]!, pairKey: 'conduit', state: 'flipped', tileTraitKind: 'conduit' },
                { ...board.tiles[1]!, pairKey: 'heavy', tileTraitKind: 'heavy' },
                { ...board.tiles[2]!, pairKey: 'conduit', tileTraitKind: 'conduit' },
                board.tiles[3]!
            ]
        };
        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board: selectedBoard,
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(states).toContain('selected-followup:1');
        expect(getCardFeedbackMarkerShapesAttr({ board: selectedBoard })).toContain('followup-target:1');
        expect(getCardFeedbackActionCuesAttr({ board: selectedBoard })).toContain('follow-up:1');
        expect(getCardFeedbackActionPriorityAttr({ board: selectedBoard })).toContain('follow-up:1');
        expect(getCardFeedbackPrimaryActionAttr({ board: selectedBoard })).toBe('follow-up');
        expect(getCardFeedbackBeatTiersAttr({ board: selectedBoard })).toContain('follow-up:1');
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board: selectedBoard })).toBe('ready:2');
        expect(getCardFeedbackTraitRouteTiersAttr({ board: selectedBoard })).toContain('selected-followup:1');
        expect(getCardFeedbackRouteGlyphsAttr({ board: selectedBoard })).toContain('next-tap:1');
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

    it('serializes only complete dev pairs in tile order', () => {
        const mixedBoard: BoardState = {
            ...board,
            pairCount: 4,
            columns: 3,
            rows: 3,
            tiles: [
                { id: 'z1', pairKey: 'Z', symbol: 'Z', label: 'Z', state: 'hidden' },
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b3', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'c1', pairKey: 'C', symbol: 'C', label: 'C', state: 'hidden' },
                { id: 'c2', pairKey: 'C', symbol: 'C', label: 'C', state: 'hidden' },
                { id: 'y1', pairKey: 'Y', symbol: 'Y', label: 'Y', state: 'hidden' }
            ]
        };
        const parsed = JSON.parse(getDevE2ePairPositionsJson(mixedBoard, true) ?? '{}') as Record<
            string,
            { row: number; col: number }[]
        >;

        expect(Object.keys(parsed)).toEqual(['A', 'C']);
        expect(parsed).toEqual({
            A: [
                { row: 1, col: 2 },
                { row: 1, col: 3 }
            ],
            C: [
                { row: 3, col: 1 },
                { row: 3, col: 2 }
            ]
        });
    });
});
