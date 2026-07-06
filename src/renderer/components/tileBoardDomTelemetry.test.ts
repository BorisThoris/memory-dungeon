import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { EXIT_PAIR_KEY } from '../../shared/tile-identity';
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
    it('exports a stable card feedback beat tier contract', () => {
        expect(CARD_FEEDBACK_BEAT_TIER_CONTRACT).toBe('cashout surge follow-up route setup');
    });

    it('exports a stable card feedback cadence contract', () => {
        expect(CARD_FEEDBACK_CADENCE_CONTRACT).toBe('cashout surge follow-up route prime');
    });

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
                { ...board.tiles[2]!, pairKey: 'mirror', tileTraitKind: 'mirror' },
                { ...board.tiles[3]!, pairKey: 'stasis', tileTraitKind: 'stasis' }
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
        expect(getCardFeedbackTraitLaneCuesAttr(traitBoard)).toBe('shard:1>guard:1>recall:1');
        expect(getCardFeedbackTraitLanePrimaryActionAttr(traitBoard)).toBe('shard:Cash shard:1');
        expect(getCardFeedbackTraitLaneBeatsAttr(traitBoard)).toBe('shard:4>guard:3>recall:3');
        expect(getCardFeedbackTraitLaneActionsAttr(traitBoard)).toBe(
            'shard:Cash shard:1>guard:Protect run:1>recall:Set memory:1'
        );
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board: traitBoard })).toBe('surge:4');
        expect(getCardFeedbackTraitRouteTiersAttr({ board: traitBoard })).toBe('surge:4');
        expect(getCardFeedbackCadencesAttr({ board: traitBoard })).toBe('surge:Route surge:4');
    });

    it('counts visible trait preview cards when the board exposes combo interactions', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
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
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                { ...board.tiles[2]!, pairKey: 'mirror', tileTraitKind: 'mirror' },
                { ...board.tiles[3]!, pairKey: 'stasis', tileTraitKind: 'stasis' }
            ]
        };

        expect(getCardFeedbackTraitLaneCuesAttr(traitBoard)).toBe('shard:1>guard:1>recall:1');
        expect(getCardFeedbackTraitLanePrimaryActionAttr(traitBoard)).toBe('shard:Cash shard:1');
        expect(getCardFeedbackTraitLaneBeatsAttr(traitBoard)).toBe('shard:4>guard:3>recall:3');
        expect(getCardFeedbackTraitLaneActionsAttr(traitBoard)).toBe(
            'shard:Cash shard:1>guard:Protect run:1>recall:Set memory:1'
        );
    });

    it('tracks multi-route trait combo surge cards separately from ordinary combo-ready cards', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                { ...board.tiles[2]!, pairKey: 'mirror', tileTraitKind: 'mirror' },
                { ...board.tiles[3]!, pairKey: 'conduit', tileTraitKind: 'conduit' }
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

    it('keeps armed perk cues visible when the same trait cards are also cash-now payoff stacks', () => {
        const traitBoard: BoardState = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };

        expect(
            getCardFeedbackActionCuesAttr({
                board: traitBoard,
                perkArmedTileIds: ['a1'],
                traitRewardHotTileIds: ['a1', 'a2']
            })
        ).toBe('cash-now:2;perk-cash:1');
        expect(
            getCardFeedbackActionPriorityAttr({
                board: traitBoard,
                perkArmedTileIds: ['a1'],
                traitRewardHotTileIds: ['a1', 'a2']
            })
        ).toBe('cash-now:2>perk-cash:1');
        expect(
            getCardFeedbackPrimaryActionAttr({
                board: traitBoard,
                perkArmedTileIds: ['a1'],
                traitRewardHotTileIds: ['a1', 'a2']
            })
        ).toBe('cash-now');
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

    it('tracks armed reward perk target markers separately from chain reward hot cards', () => {
        const perkBoard = {
            ...board,
            tiles: [
                { ...board.tiles[0]!, pairKey: 'cursed', tileTraitKind: 'cursed' as const },
                board.tiles[1]!,
                board.tiles[2]!,
                board.tiles[3]!
            ]
        };
        const states = getCardFeedbackStatesAttr({
            allowGambitThirdFlip: false,
            board: perkBoard,
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            perkArmedTileIds: ['a1']
        });

        expect(states).toContain('perk-armed:1');
        expect(getCardFeedbackMarkerShapesAttr({ board: perkBoard, perkArmedTileIds: ['a1'] })).toContain(
            'perk-armed-bar:1'
        );
        expect(getCardFeedbackActionCuesAttr({ board: perkBoard, perkArmedTileIds: ['a1'] })).toBe('perk-cash:1');
        expect(getCardFeedbackTraitRouteTiersAttr({ board: perkBoard, perkArmedTileIds: ['a1'] })).toBe(
            'perk-armed:1'
        );
        expect(getCardFeedbackTraitRouteIntensitiesAttr({ board: perkBoard, perkArmedTileIds: ['a1'] })).toBe(
            'setup:1'
        );
        expect(getCardFeedbackRouteGlyphsAttr({ board: perkBoard, perkArmedTileIds: ['a1'] })).toBe(
            'prime-cross:1'
        );
    });

    it('tracks selected trait followup mates separately from generic chain-ready cards', () => {
        const selectedBoard: BoardState = {
            ...board,
            flippedTileIds: ['a1'],
            tiles: [
                { ...board.tiles[0]!, pairKey: 'echo', state: 'flipped', tileTraitKind: 'echo' },
                { ...board.tiles[1]!, pairKey: 'sealed', tileTraitKind: 'sealed' },
                { ...board.tiles[2]!, pairKey: 'echo', tileTraitKind: 'echo' },
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
});
