import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from '../../shared/contracts';
import { buildTileBoardDomSurfaceModel } from './tileBoardDomSurfaceModel';

const tile = (id: string, pairKey: string, state: Tile['state'], overrides: Partial<Tile> = {}): Tile => ({
    id,
    label: id,
    pairKey,
    state,
    symbol: id,
    ...overrides
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

describe('tileBoardDomSurfaceModel', () => {
    it('aggregates fallback telemetry and card feedback attributes', () => {
        const result = buildTileBoardDomSurfaceModel({
            allowGambitThirdFlip: false,
            board: board([
                tile('a1', 'a', 'hidden'),
                tile('a2', 'a', 'flipped'),
                tile('trap', 'trap', 'hidden', {
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'hidden'
                })
            ], {
                flippedTileIds: ['a2']
            }),
            boardApplicationFocused: true,
            debugPeekActive: false,
            focusedTileId: 'a1',
            includeDevAttributes: true,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(result.hiddenTileCount).toBe(2);
        expect(result.hiddenSlotsAttr).toContain('1,1');
        expect(result.hiddenTrapSlotsAttr).toContain('2,1');
        expect(result.pickableHiddenSlotsAttr).toContain('1,1');
        expect(result.cardFeedbackStatesAttr).toContain('hidden:2');
        expect(result.cardFeedbackStatesAttr).toContain('focused:1');
        expect(result.cardFeedbackPrimaryActionAttr).toBe('none');
        expect(result.cardFeedbackActionPriorityAttr).toBe('');
        expect(result.cardFeedbackBeatCountsAttr).toBe('');
        expect(result.cardFeedbackBeatTiersAttr).toBe('');
        expect(result.cardFeedbackTraitLaneActionsAttr).toBe('');
        expect(result.cardFeedbackTraitLaneBeatsAttr).toBe('');
        expect(result.cardFeedbackTraitLaneCuesAttr).toBe('');
        expect(result.cardFeedbackTraitLanePrimaryActionAttr).toBe('none');
    });

    it('surfaces primary card action priority for reward-hot trait routes', () => {
        const result = buildTileBoardDomSurfaceModel({
            allowGambitThirdFlip: false,
            board: board([
                tile('echo', 'echo', 'hidden', { tileTraitKind: 'echo' }),
                tile('sealed', 'sealed', 'hidden', { tileTraitKind: 'sealed' }),
                tile('x1', 'x', 'hidden'),
                tile('x2', 'x', 'hidden')
            ]),
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            includeDevAttributes: true,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            traitRewardHotTileIds: ['echo', 'sealed']
        });

        expect(result.cardFeedbackActionCuesAttr).toBe('cash-now:2');
        expect(result.cardFeedbackActionPriorityAttr).toBe('cash-now:2');
        expect(result.cardFeedbackBeatCountsAttr).toBe('5:2');
        expect(result.cardFeedbackBeatTiersAttr).toBe('cashout:2');
        expect(result.cardFeedbackPrimaryActionAttr).toBe('cash-now');
        expect(result.cardFeedbackRouteGlyphsAttr).toBe('payoff-stack:2');
        expect(result.cardFeedbackTraitLaneActionsAttr).toBe('shard:Cash shard:1');
        expect(result.cardFeedbackTraitLaneBeatsAttr).toBe('shard:4');
        expect(result.cardFeedbackTraitLaneCuesAttr).toBe('shard:1');
        expect(result.cardFeedbackTraitLanePrimaryActionAttr).toBe('shard:Cash shard:1');
        expect(result.cardFeedbackTraitRouteIntensitiesAttr).toBe('stack:2');
        expect(result.cardFeedbackTraitRouteTiersAttr).toBe('payoff-stack:2');
    });

    it('surfaces card-level beat tiers for setup and follow-up route cards', () => {
        const result = buildTileBoardDomSurfaceModel({
            allowGambitThirdFlip: false,
            board: board([
                tile('echo-a', 'echo', 'flipped', { tileTraitKind: 'echo' }),
                tile('sealed-a', 'sealed', 'matched', { tileTraitKind: 'sealed' }),
                tile('echo-b', 'echo', 'hidden', { tileTraitKind: 'echo' }),
                tile('plain', 'plain', 'hidden')
            ], {
                flippedTileIds: ['echo-a']
            }),
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            includeDevAttributes: true,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing',
            selectedTraitFollowupTileIds: ['echo-b'],
            traitRouteTargetTileIds: ['plain']
        });

        expect(result.cardFeedbackActionCuesAttr).toBe('follow-up:1;route-setup:1');
        expect(result.cardFeedbackBeatCountsAttr).toBe('3:1>2:1');
        expect(result.cardFeedbackBeatTiersAttr).toBe('follow-up:1>setup:1');
        expect(result.cardFeedbackRouteGlyphsAttr).toBe('next-tap:1;prime-cross:1');
        expect(result.cardFeedbackTraitRouteTiersAttr).toContain('selected-followup:1');
        expect(result.cardFeedbackTraitRouteTiersAttr).toContain('route-target:1');
    });

    it('tracks resolved trap slots and counts', () => {
        const result = buildTileBoardDomSurfaceModel({
            allowGambitThirdFlip: false,
            board: board([
                tile('trap-a', 'trap', 'matched', {
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'resolved'
                }),
                tile('trap-b', 'trap', 'matched', {
                    dungeonCardKind: 'trap',
                    dungeonCardState: 'resolved'
                })
            ]),
            boardApplicationFocused: false,
            debugPeekActive: false,
            focusedTileId: null,
            includeDevAttributes: true,
            interactive: true,
            peekRevealedTileIds: new Set(),
            previewActive: false,
            runStatus: 'playing'
        });

        expect(result.resolvedTrapTileCount).toBe(2);
        expect(result.resolvedTrapSlotsAttr).toContain('1,1');
        expect(result.resolvedTrapSlotsAttr).toContain('1,2');
    });
});
