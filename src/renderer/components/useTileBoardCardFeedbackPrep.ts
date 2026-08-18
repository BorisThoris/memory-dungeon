import { useMemo } from 'react';
import type { BoardState, RewardPerkId, RunStatus } from '../../shared/contracts';
import {
    getSelectedTraitFollowupTileIds,
    getTraitOpportunityTileIds
} from '../../shared/trait-opportunities';
import { getChainRewardForecastCues } from '../copy/chainMomentum';
import {
    buildTileBoardCardFeedbackState,
    type buildTileBoardCardFeedbackState as buildTileBoardCardFeedbackStateType
} from './tileBoardCardFeedbackState';

interface TileBoardChainContext {
    armedPerkDetail?: string | null;
    armedPerkId?: RewardPerkId | null;
    armedPerkLabel?: string | null;
    armedPerkPayoff?: string | null;
    comboShards: number;
    currentStreak: number;
    lives: number;
}

interface TileBoardCardFeedbackPrepArgs {
    allowGambitThirdFlip: boolean;
    board: BoardState;
    boardApplicationFocused: boolean;
    chainContext?: TileBoardChainContext;
    debugPeekActive: boolean;
    focusedTileId: string | null;
    includeDevAttributes: boolean;
    interactive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    previewActive: boolean;
    runStatus: RunStatus;
    traitRouteTargetTileIds?: readonly string[];
}

export const useTileBoardCardFeedbackPrep = ({
    allowGambitThirdFlip,
    board,
    boardApplicationFocused,
    chainContext,
    debugPeekActive,
    focusedTileId,
    includeDevAttributes,
    interactive,
    peekRevealedTileIds,
    previewActive,
    runStatus,
    traitRouteTargetTileIds
}: TileBoardCardFeedbackPrepArgs): {
    cardFeedbackState: ReturnType<typeof buildTileBoardCardFeedbackStateType>;
    perkArmedTileIds: string[];
    selectedTraitFollowupTileIds: string[];
    traitRewardHotTileIds: string[];
} => {
    const traitRewardHotTileIds = useMemo(() => {
        if (runStatus !== 'playing' || !chainContext) {
            return [];
        }
        const nextReward = getChainRewardForecastCues(
            chainContext.currentStreak + 1,
            chainContext.comboShards,
            chainContext.lives
        )[0];
        if (!nextReward || nextReward.distance > 1) {
            return [];
        }
        return [...getTraitOpportunityTileIds(board)];
    }, [board, chainContext, runStatus]);

    const perkArmedTileIds = useMemo(() => {
        if (runStatus !== 'playing' || !chainContext?.armedPerkId) {
            return [];
        }
        if (chainContext.armedPerkId === 'trait_streak_toolkit') {
            return [...getTraitOpportunityTileIds(board)];
        }
        if (chainContext.armedPerkId === 'cursed_opener_greed') {
            return board.tiles
                .filter((tile) => tile.state === 'hidden' && tile.tileTraitKind === 'cursed')
                .map((tile) => tile.id);
        }
        if (chainContext.armedPerkId === 'echo_conduit_double') {
            return board.tiles
                .filter((tile) => tile.state === 'hidden' && (tile.tileTraitKind === 'echo' || tile.tileTraitKind === 'conduit'))
                .map((tile) => tile.id);
        }
        return [];
    }, [board, chainContext, runStatus]);

    const selectedTraitFollowupTileIds = useMemo(() => {
        if (runStatus !== 'playing') {
            return [];
        }
        return [...getSelectedTraitFollowupTileIds(board)];
    }, [board, runStatus]);

    const cardFeedbackState = useMemo(
        () =>
            buildTileBoardCardFeedbackState({
                domSurface: {
                    allowGambitThirdFlip,
                    board,
                    boardApplicationFocused,
                    debugPeekActive,
                    focusedTileId,
                    includeDevAttributes,
                    interactive,
                    peekRevealedTileIds,
                    previewActive,
                    runStatus,
                    perkArmedTileIds,
                    selectedTraitFollowupTileIds,
                    traitRewardHotTileIds,
                    traitRouteTargetTileIds
                }
            }),
        [
            allowGambitThirdFlip,
            board,
            boardApplicationFocused,
            debugPeekActive,
            focusedTileId,
            includeDevAttributes,
            interactive,
            peekRevealedTileIds,
            perkArmedTileIds,
            previewActive,
            runStatus,
            selectedTraitFollowupTileIds,
            traitRewardHotTileIds,
            traitRouteTargetTileIds
        ]
    );

    return {
        cardFeedbackState,
        perkArmedTileIds,
        selectedTraitFollowupTileIds,
        traitRewardHotTileIds
    };
};
