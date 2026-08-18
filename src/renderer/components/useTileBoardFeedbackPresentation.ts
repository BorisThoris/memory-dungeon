import { useMemo } from 'react';
import type { BoardState, RewardPerkId, RunStatus } from '../../shared/contracts';
import type { buildTileBoardCardFeedbackState } from './tileBoardCardFeedbackState';
import { parseCountAttribute } from './tileBoardCardFeedbackState';
import { buildBoardFeedbackModelState } from './tileBoardFeedbackModelState';
import { buildBoardFeedbackFocusState } from './tileBoardFeedbackRuntimeState';
import { buildBoardFeedbackSurfaceComposition } from './tileBoardFeedbackSurfaceComposition';
import { useTileBoardFeedbackRuntime } from './useTileBoardFeedbackRuntime';
import { useTileBoardLiveAnnouncement } from './useTileBoardLiveAnnouncement';

interface TileBoardChainContext {
    armedPerkDetail?: string | null;
    armedPerkId?: RewardPerkId | null;
    armedPerkLabel?: string | null;
    armedPerkPayoff?: string | null;
    comboShards: number;
    currentStreak: number;
    lives: number;
}

interface TileBoardRecoveryContext {
    action: string;
    detail: string;
    impactCue: string;
    value: string;
    tone: 'recover' | 'risk' | 'lost-reward';
}

interface TileBoardFeedbackPresentationArgs {
    announceBoardLiveMessage: (message: string) => void;
    board: BoardState;
    boardApplicationFocused: boolean;
    cardFeedbackState: ReturnType<typeof buildTileBoardCardFeedbackState>;
    chainContext?: TileBoardChainContext;
    debugPeekActive: boolean;
    destroyEligibleTileIds: ReadonlySet<string>;
    destroyPowerVisualActive: boolean;
    focusedTileId: string | null;
    pairProximityHintsEnabled: boolean;
    peekEligibleTileIds: ReadonlySet<string>;
    peekPowerVisualActive: boolean;
    peekRevealedTileIds: ReadonlySet<string>;
    pinModeBoardHintActive: boolean;
    previewActive: boolean;
    recoveryContext?: TileBoardRecoveryContext | null;
    reduceMotion: boolean;
    resolvedTrapTileCount: number;
    runStatus: RunStatus;
    selectedTraitFollowupTileIds: readonly string[];
    shuffleSfxGain: number;
    strayEligibleTileIds: ReadonlySet<string>;
    strayPowerVisualActive: boolean;
    tileSwapEligibleTileIds: ReadonlySet<string>;
    tileSwapFirstTileId: string | null;
    tileSwapPowerVisualActive: boolean;
    traitRewardHotTileIds: readonly string[];
    traitRouteHintText?: string | null;
    traitRouteTargetTileIds?: readonly string[];
}

const formatBoardFeedbackLabel = (
    label: string,
    rows: readonly (string | null | undefined)[]
): string => {
    const rowCopy = rows.filter((row): row is string => Boolean(row)).join('. ');
    return rowCopy ? `${label}. ${rowCopy}.` : label;
};

export const useTileBoardFeedbackPresentation = ({
    announceBoardLiveMessage,
    board,
    boardApplicationFocused,
    cardFeedbackState,
    chainContext,
    debugPeekActive,
    destroyEligibleTileIds,
    destroyPowerVisualActive,
    focusedTileId,
    pairProximityHintsEnabled,
    peekEligibleTileIds,
    peekPowerVisualActive,
    peekRevealedTileIds,
    pinModeBoardHintActive,
    previewActive,
    recoveryContext,
    reduceMotion,
    resolvedTrapTileCount,
    runStatus,
    selectedTraitFollowupTileIds,
    shuffleSfxGain,
    strayEligibleTileIds,
    strayPowerVisualActive,
    tileSwapEligibleTileIds,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive,
    traitRewardHotTileIds,
    traitRouteHintText,
    traitRouteTargetTileIds
}: TileBoardFeedbackPresentationArgs) => {
    const { focusedTileLabel, traitRewardHotText } = useMemo(
        () =>
            buildBoardFeedbackFocusState({
                chainContext,
                focusedTileLiveLabel: {
                    board,
                    debugPeekActive,
                    destroyEligibleTileIds,
                    destroyPowerVisualActive,
                    focusedTileId,
                    pairProximityHintsEnabled,
                    peekEligibleTileIds,
                    peekPowerVisualActive,
                    peekRevealedTileIds,
                    previewActive,
                    runStatus,
                    strayEligibleTileIds,
                    strayPowerVisualActive,
                    tileSwapEligibleTileIds,
                    tileSwapFirstTileId,
                    tileSwapPowerVisualActive,
                    traitRewardHotTileIds,
                    traitRouteHintText,
                    traitRouteTargetTileIds
                },
                runStatus
            }),
        [
            board,
            chainContext,
            debugPeekActive,
            destroyEligibleTileIds,
            destroyPowerVisualActive,
            focusedTileId,
            pairProximityHintsEnabled,
            peekEligibleTileIds,
            peekPowerVisualActive,
            peekRevealedTileIds,
            previewActive,
            runStatus,
            strayEligibleTileIds,
            strayPowerVisualActive,
            tileSwapEligibleTileIds,
            tileSwapFirstTileId,
            tileSwapPowerVisualActive,
            traitRewardHotTileIds,
            traitRouteHintText,
            traitRouteTargetTileIds
        ]
    );

    const boardFeedbackModelState = useMemo(
        () =>
            buildBoardFeedbackModelState({
                board,
                boardApplicationFocused,
                cardFeedbackMarkerShapesAttr: cardFeedbackState.cardFeedbackMarkerShapesAttr,
                cardFeedbackRouteGlyphsAttr: cardFeedbackState.cardFeedbackRouteGlyphsAttr,
                cardFeedbackStatesAttr: cardFeedbackState.cardFeedbackStatesAttr,
                cardFeedbackTraitPayoffStackActive: cardFeedbackState.cardFeedbackTraitPayoffStackActive,
                cardFeedbackTraitRouteIntensitiesAttr: cardFeedbackState.cardFeedbackTraitRouteIntensitiesAttr,
                chainContext,
                deps: { formatLabel: formatBoardFeedbackLabel },
                destroyPowerVisualActive,
                focusedTileId,
                parseCountAttribute,
                peekPowerVisualActive,
                pinModeBoardHintActive,
                recoveryContext,
                runStatus,
                selectedTraitFollowupTileIds,
                strayPowerVisualActive,
                tileSwapFirstTileId,
                tileSwapPowerVisualActive,
                traitRewardHotText,
                traitRewardHotTileIds,
                traitRouteHintText,
                traitRouteTargetTileIds
            }),
        [
            board,
            boardApplicationFocused,
            cardFeedbackState,
            chainContext,
            destroyPowerVisualActive,
            focusedTileId,
            peekPowerVisualActive,
            pinModeBoardHintActive,
            recoveryContext,
            runStatus,
            selectedTraitFollowupTileIds,
            strayPowerVisualActive,
            tileSwapFirstTileId,
            tileSwapPowerVisualActive,
            traitRewardHotText,
            traitRewardHotTileIds,
            traitRouteHintText,
            traitRouteTargetTileIds
        ]
    );

    const {
        lastResolutionFeedback,
        trapResolutionDetails,
        trapResolutionMessage
    } = useTileBoardFeedbackRuntime({
        board,
        boardFeedbackModelState,
        resolvedTrapTileCount,
        runStatus,
        shuffleSfxGain
    });

    const surfaceComposition = useMemo(
        () =>
            buildBoardFeedbackSurfaceComposition({
                boardFeedbackModelState,
                cardFeedbackState,
                deps: { formatLabel: formatBoardFeedbackLabel },
                lastResolutionFeedback,
                reduceMotion
            }),
        [
            boardFeedbackModelState,
            cardFeedbackState,
            lastResolutionFeedback,
            reduceMotion
        ]
    );

    useTileBoardLiveAnnouncement({
        announceBoardLiveMessage,
        boardFeedbackModelState,
        boardOpportunityLaneMapLiveText: surfaceComposition.boardOpportunityLaneMapLiveText,
        boardPayoffStack: surfaceComposition.boardPayoffStack,
        focusedTileLabel
    });

    return {
        boardChainOpportunity: boardFeedbackModelState.boardChainOpportunity,
        boardChainOpportunitySurfaceView: surfaceComposition.boardChainOpportunitySurfaceView,
        boardOpportunityCompassView: surfaceComposition.boardOpportunityCompassView,
        boardOpportunityLaneMapView: surfaceComposition.boardOpportunityLaneMapView,
        boardStatusChipsView: surfaceComposition.boardStatusChipsView,
        cardFeedbackTelemetryAttrs: surfaceComposition.cardFeedbackTelemetryAttrs,
        chainFeedbackTelemetryAttrs: surfaceComposition.chainFeedbackTelemetryAttrs,
        focusedPreviewChipView: surfaceComposition.focusedPreviewChipView,
        opportunityFeedbackTelemetryAttrs: surfaceComposition.opportunityFeedbackTelemetryAttrs,
        statusFeedbackTelemetryAttrs: surfaceComposition.statusFeedbackTelemetryAttrs,
        trapResolutionDetails,
        trapResolutionMessage
    };
};
