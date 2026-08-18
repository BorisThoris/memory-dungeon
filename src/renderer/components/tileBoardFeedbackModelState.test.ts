import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { buildBoardFeedbackModelState } from './tileBoardFeedbackModelState';
import { parseCountAttribute } from './tileBoardCardFeedbackState';

const formatLabel = (label: string, rows: readonly (string | null | undefined)[]) =>
    [label, ...rows.filter((row): row is string => Boolean(row))].join(': ');

describe('tileBoardFeedbackModelState', () => {
    it('builds upstream board feedback model state before surface composition', () => {
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
                { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden', tileHazardKind: 'shuffle_snare' },
                { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
            ]
        };

        const state = buildBoardFeedbackModelState({
            board,
            boardApplicationFocused: true,
            cardFeedbackMarkerShapesAttr: 'none',
            cardFeedbackRouteGlyphsAttr: 'none',
            cardFeedbackStatesAttr: 'route:1|hazard:1|hidden:4',
            cardFeedbackTraitPayoffStackActive: false,
            cardFeedbackTraitRouteIntensitiesAttr: 'setup:1',
            chainContext: {
                comboShards: 2,
                currentStreak: 3,
                lives: 2
            },
            deps: { formatLabel },
            destroyPowerVisualActive: false,
            focusedTileId: 'a1',
            parseCountAttribute,
            peekPowerVisualActive: false,
            pinModeBoardHintActive: false,
            recoveryContext: null,
            runStatus: 'playing',
            selectedTraitFollowupTileIds: [],
            strayPowerVisualActive: false,
            tileSwapFirstTileId: null,
            tileSwapPowerVisualActive: true,
            traitRewardHotText: null,
            traitRewardHotTileIds: [],
            traitRouteHintText: 'Move route tiles together',
            traitRouteTargetTileIds: ['a1', 'a2']
        });

        expect(state.activePowerBoardChip?.action).toBe('swap');
        expect(state.boardOpportunityCompassRows.some((row) => row.id === 'tool')).toBe(true);
        expect(state.boardRewardLadderState.entries.length).toBeGreaterThan(0);
        expect(state.boardChainOpportunity.nextActionId).toBeTruthy();
        expect(state.boardChainOpportunityLabel.length).toBeGreaterThan(0);
        expect(state.boardChainOpportunityNextActionVerb).toBeTruthy();
    });
});
