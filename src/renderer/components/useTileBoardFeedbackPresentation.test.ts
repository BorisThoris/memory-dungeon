import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { buildTileBoardCardFeedbackState } from './tileBoardCardFeedbackState';
import { useTileBoardFeedbackPresentation } from './useTileBoardFeedbackPresentation';

vi.mock('../audio/gameSfx', () => ({
    playChainOpportunityBeatSfx: vi.fn(),
    resumeAudioContext: vi.fn().mockResolvedValue(undefined)
}));

const baseBoard: BoardState = {
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: ['a1', 'a2'],
    floorArchetypeId: null,
    level: 1,
    matchedPairs: 0,
    pairCount: 2,
    rows: 2,
    tiles: [
        { id: 'a1', pairKey: 'A', symbol: 'A', label: 'Snare', state: 'flipped', dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
        { id: 'a2', pairKey: 'A', symbol: 'A', label: 'Snare', state: 'flipped', dungeonCardKind: 'trap', dungeonCardState: 'resolved' },
        { id: 'b1', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' },
        { id: 'b2', pairKey: 'B', symbol: 'B', label: 'B', state: 'hidden' }
    ]
};

describe('useTileBoardFeedbackPresentation', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('composes the board feedback pipeline and publishes runtime feedback', async () => {
        let announcedMessage = '';
        const cardFeedbackState = buildTileBoardCardFeedbackState({
            domSurface: {
                allowGambitThirdFlip: false,
                board: baseBoard,
                boardApplicationFocused: true,
                debugPeekActive: false,
                focusedTileId: 'a1',
                includeDevAttributes: false,
                interactive: true,
                peekRevealedTileIds: new Set<string>(),
                previewActive: false,
                runStatus: 'resolving',
                perkArmedTileIds: [],
                selectedTraitFollowupTileIds: [],
                traitRewardHotTileIds: [],
                traitRouteTargetTileIds: []
            }
        });

        const { result, rerender } = renderHook(
            ({ resolvedTrapTileCount }: { resolvedTrapTileCount: number }) =>
                useTileBoardFeedbackPresentation({
                    announceBoardLiveMessage: (message) => {
                        announcedMessage = message;
                    },
                    board: baseBoard,
                    boardApplicationFocused: true,
                    cardFeedbackState,
                    debugPeekActive: false,
                    destroyEligibleTileIds: new Set<string>(),
                    destroyPowerVisualActive: false,
                    focusedTileId: 'a1',
                    pairProximityHintsEnabled: false,
                    peekEligibleTileIds: new Set<string>(),
                    peekPowerVisualActive: false,
                    peekRevealedTileIds: new Set<string>(),
                    pinModeBoardHintActive: false,
                    previewActive: false,
                    reduceMotion: true,
                    resolvedTrapTileCount,
                    runStatus: 'resolving',
                    selectedTraitFollowupTileIds: [],
                    shuffleSfxGain: 1,
                    strayEligibleTileIds: new Set<string>(),
                    strayPowerVisualActive: false,
                    tileSwapEligibleTileIds: new Set<string>(),
                    tileSwapFirstTileId: null,
                    tileSwapPowerVisualActive: false,
                    traitRewardHotTileIds: [],
                    traitRouteHintText: null,
                    traitRouteTargetTileIds: []
                }),
            { initialProps: { resolvedTrapTileCount: 0 } }
        );

        rerender({ resolvedTrapTileCount: 2 });

        await waitFor(() => {
            expect(result.current.cardFeedbackTelemetryAttrs['data-card-feedback-last-resolution']).toContain('match:2');
            expect(result.current.trapResolutionMessage).toContain('Trap resolved: Snare');
            expect(result.current.trapResolutionDetails?.effect).toBe('Trap effect paid');
            expect(announcedMessage).toContain('Focus:');
        });
    });
});
