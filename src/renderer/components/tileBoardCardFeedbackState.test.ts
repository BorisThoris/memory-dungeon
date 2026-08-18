import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { buildTileBoardCardFeedbackState } from './tileBoardCardFeedbackState';

describe('tileBoardCardFeedbackState', () => {
    it('builds dom feedback attrs, derived maps, and combo flags together', () => {
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
                { id: 'a1', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden', routeCardKind: 'greed_cache' },
                { id: 'a2', pairKey: 'A', symbol: 'A', label: 'A', state: 'hidden' },
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        const state = buildTileBoardCardFeedbackState({
            domSurface: {
                allowGambitThirdFlip: false,
                board,
                boardApplicationFocused: true,
                debugPeekActive: false,
                focusedTileId: 'a1',
                includeDevAttributes: false,
                interactive: true,
                peekRevealedTileIds: new Set<string>(),
                previewActive: false,
                runStatus: 'playing',
                perkArmedTileIds: [],
                selectedTraitFollowupTileIds: [],
                traitRewardHotTileIds: [],
                traitRouteTargetTileIds: []
            }
        });

        expect(state.hiddenTileCount).toBe(4);
        expect(state.cardFeedbackActionPriorityRows).toHaveLength(0);
        expect(state.cardFeedbackActionPriorityAttr).toBe('');
        expect(state.cardFeedbackTraitComboSurgeActive).toBe(false);
        expect(state.cardFeedbackTraitPayoffStackActive).toBe(false);
        expect(state.primaryCardFeedbackShotRow).toBeNull();
        expect(state.cardFeedbackStatesValue).toContain('hidden:4');
    });
});
