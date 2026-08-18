import { renderHook } from '@testing-library/react';
import type { BoardState } from '../../shared/contracts';
import { describe, expect, it } from 'vitest';
import { useTileBoardCardFeedbackPrep } from './useTileBoardCardFeedbackPrep';

const board: BoardState = {
    columns: 2,
    featuredObjectiveId: null,
    flippedTileIds: ['echo-a'],
    floorArchetypeId: null,
    level: 1,
    matchedPairs: 0,
    pairCount: 2,
    rows: 2,
    tiles: [
        { id: 'echo-a', label: 'Echo', pairKey: 'echo', state: 'flipped', symbol: 'E', tileTraitKind: 'echo' },
        { id: 'sealed-a', label: 'Sealed', pairKey: 'sealed', state: 'hidden', symbol: 'S', tileTraitKind: 'sealed' },
        { id: 'echo-b', label: 'Echo', pairKey: 'echo', state: 'hidden', symbol: 'E', tileTraitKind: 'echo' },
        { id: 'plain-a', label: 'Plain', pairKey: 'plain', state: 'hidden', symbol: 'P' }
    ]
};

describe('useTileBoardCardFeedbackPrep', () => {
    it('prepares trait-hot, perk-armed, follow-up, and card feedback state from the board', () => {
        const { result } = renderHook(() =>
            useTileBoardCardFeedbackPrep({
                allowGambitThirdFlip: false,
                board,
                boardApplicationFocused: true,
                chainContext: {
                    armedPerkId: 'trait_streak_toolkit',
                    comboShards: 1,
                    currentStreak: 2,
                    lives: 4
                },
                debugPeekActive: false,
                focusedTileId: 'echo-a',
                includeDevAttributes: false,
                interactive: true,
                peekRevealedTileIds: new Set<string>(),
                previewActive: false,
                runStatus: 'playing',
                traitRouteTargetTileIds: []
            })
        );

        expect(result.current.selectedTraitFollowupTileIds).toEqual(['echo-b']);
        expect(result.current.perkArmedTileIds).toEqual(expect.arrayContaining(['echo-a', 'sealed-a', 'echo-b']));
        expect(result.current.traitRewardHotTileIds).toEqual(expect.arrayContaining(['echo-a', 'sealed-a', 'echo-b']));
        expect(result.current.cardFeedbackState.cardFeedbackStatesAttr).toContain('focused:1');
        expect(result.current.cardFeedbackState.cardFeedbackStatesAttr).toContain('flipped:1');
    });
});
