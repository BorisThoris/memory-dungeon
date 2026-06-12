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
