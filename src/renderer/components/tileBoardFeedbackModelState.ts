import type { BoardState } from '../../shared/contracts';
import { getTraitOpportunitySummary } from '../../shared/trait-opportunities';
import { buildBoardChainDisplayState } from './tileBoardChainDisplayState';
import { buildBoardChainFeedbackSummaryState } from './tileBoardFeedbackSummaryState';
import {
    buildActivePowerBoardChip,
    buildBoardChainOpportunity,
    buildBoardChainSequenceCue,
    buildBoardHazardOpportunity,
    buildBoardOpportunityCompassRows,
    buildBoardPickupOpportunity,
    buildBoardRewardLadderState,
    buildBoardTraitModeCue
} from './tileBoardFeedbackState';

type BuildBoardPickupOpportunityArgs = Parameters<typeof buildBoardPickupOpportunity>[0];
type BuildBoardChainOpportunityArgs = Parameters<typeof buildBoardChainOpportunity>[0];
type BuildBoardRewardLadderArgs = Parameters<typeof buildBoardRewardLadderState>[0];
type BuildActivePowerBoardChipArgs = Parameters<typeof buildActivePowerBoardChip>[0];
type BuildBoardChainDisplayArgs = Parameters<typeof buildBoardChainDisplayState>[0];
type BuildBoardOpportunityCompassRowsArgs = Parameters<typeof buildBoardOpportunityCompassRows>[0];

interface BoardFeedbackModelFormatDeps {
    formatLabel: BuildBoardRewardLadderArgs['deps']['formatLabel'];
}

interface BoardFeedbackModelStateArgs {
    board: BoardState;
    boardApplicationFocused: BuildBoardChainDisplayArgs['boardApplicationFocused'];
    cardFeedbackMarkerShapesAttr: BuildBoardChainDisplayArgs['cardFeedbackMarkerShapesAttr'];
    cardFeedbackRouteGlyphsAttr: BuildBoardChainDisplayArgs['cardFeedbackRouteGlyphsAttr'];
    cardFeedbackStatesAttr: BuildBoardChainDisplayArgs['cardFeedbackStatesAttr'];
    cardFeedbackTraitPayoffStackActive: BuildBoardOpportunityCompassRowsArgs['cardFeedbackTraitPayoffStackActive'];
    cardFeedbackTraitRouteIntensitiesAttr: BuildBoardChainDisplayArgs['cardFeedbackTraitRouteIntensitiesAttr'];
    chainContext: BuildBoardPickupOpportunityArgs['chainContext'];
    deps: BoardFeedbackModelFormatDeps;
    destroyPowerVisualActive: BuildActivePowerBoardChipArgs['destroyPowerVisualActive'];
    focusedTileId: BuildBoardChainDisplayArgs['focusedTileId'];
    parseCountAttribute: BuildBoardChainDisplayArgs['parseCountAttribute'];
    peekPowerVisualActive: BuildActivePowerBoardChipArgs['peekPowerVisualActive'];
    pinModeBoardHintActive: BuildActivePowerBoardChipArgs['pinModeBoardHintActive'];
    recoveryContext: BuildBoardOpportunityCompassRowsArgs['recoveryContext'];
    runStatus: BuildBoardPickupOpportunityArgs['runStatus'];
    selectedTraitFollowupTileIds: BuildBoardChainOpportunityArgs['selectedTraitFollowupTileIds'];
    strayPowerVisualActive: BuildActivePowerBoardChipArgs['strayPowerVisualActive'];
    tileSwapFirstTileId: BuildActivePowerBoardChipArgs['tileSwapFirstTileId'];
    tileSwapPowerVisualActive: BuildActivePowerBoardChipArgs['tileSwapPowerVisualActive'];
    traitRewardHotText: BuildBoardChainDisplayArgs['traitRewardHotText'];
    traitRewardHotTileIds: BuildBoardChainDisplayArgs['traitRewardHotTileIds'];
    traitRouteHintText: BuildBoardChainOpportunityArgs['traitRouteHintText'];
    traitRouteTargetTileIds: BuildBoardChainOpportunityArgs['traitRouteTargetTileIds'];
}

export const buildBoardFeedbackModelState = ({
    board,
    boardApplicationFocused,
    cardFeedbackMarkerShapesAttr,
    cardFeedbackRouteGlyphsAttr,
    cardFeedbackStatesAttr,
    cardFeedbackTraitPayoffStackActive,
    cardFeedbackTraitRouteIntensitiesAttr,
    chainContext,
    deps,
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
}: BoardFeedbackModelStateArgs) => {
    const boardPickupOpportunity = buildBoardPickupOpportunity({ board, chainContext, runStatus });
    const boardChainOpportunity = buildBoardChainOpportunity({
        board,
        chainContext,
        runStatus,
        selectedTraitFollowupTileIds,
        traitRouteHintText,
        traitRouteTargetTileIds
    });
    const boardRewardLadderState = buildBoardRewardLadderState({
        chainContext,
        deps,
        rewardUrgencyTier: boardChainOpportunity.rewardUrgencyTier,
        runStatus
    });
    const boardTraitModeCue = buildBoardTraitModeCue({
        boardChainOpportunity,
        cardFeedbackStatesAttr,
        runStatus
    });
    const boardChainSequenceCue = buildBoardChainSequenceCue({ boardChainOpportunity, runStatus });
    const boardChainFeedbackSummaryState = buildBoardChainFeedbackSummaryState({
        opportunity: boardChainOpportunity,
        sequenceCue: boardChainSequenceCue
    });
    const boardHazardOpportunity = buildBoardHazardOpportunity({ board, runStatus });
    const activePowerBoardChip = buildActivePowerBoardChip({
        destroyPowerVisualActive,
        peekPowerVisualActive,
        pinModeBoardHintActive,
        runStatus,
        strayPowerVisualActive,
        tileSwapFirstTileId,
        tileSwapPowerVisualActive
    });
    const traitOpportunitySummary = getTraitOpportunitySummary(board);
    const boardChainDisplayState = buildBoardChainDisplayState({
        board,
        boardApplicationFocused,
        boardChainOpportunity,
        boardTraitModeCue,
        cardFeedbackMarkerShapesAttr,
        cardFeedbackRouteGlyphsAttr,
        cardFeedbackStatesAttr,
        cardFeedbackTraitRouteIntensitiesAttr,
        deps,
        focusedTileId,
        parseCountAttribute,
        selectedTraitFollowupTileIds,
        tileSwapFirstTileId,
        tileSwapPowerVisualActive,
        traitOpportunityInteractionLines: traitOpportunitySummary.interactionLines,
        traitRewardHotText,
        traitRewardHotTileIds,
        traitRouteHintText,
        traitRouteTargetTileIds
    });
    const boardOpportunityCompassRows = buildBoardOpportunityCompassRows({
        activePowerBoardChip,
        boardChainOpportunity,
        boardHazardOpportunity,
        boardPickupOpportunity,
        cardFeedbackTraitPayoffStackActive,
        recoveryContext,
        runStatus,
        traitOpportunitySummary
    });

    return {
        activePowerBoardChip,
        boardChainOpportunity,
        boardChainSequenceCue,
        boardHazardOpportunity,
        boardOpportunityCompassRows,
        boardPickupOpportunity,
        boardRewardLadderState,
        boardTraitModeCue,
        boardChainCueMeterFill: boardChainFeedbackSummaryState.cueMeterFill,
        boardChainCueMeterState: boardChainFeedbackSummaryState.cueMeterState,
        boardChainOpportunityNextActionMeterFill: boardChainFeedbackSummaryState.nextActionMeterFill,
        boardChainOpportunityNextActionTier: boardChainFeedbackSummaryState.nextActionTier,
        boardChainOpportunityNextActionVerb: boardChainFeedbackSummaryState.nextActionVerb,
        boardChainOpportunityPriorityId: boardChainFeedbackSummaryState.priorityId,
        boardChainSequenceAccessibleLabel: boardChainFeedbackSummaryState.sequenceAccessibleLabel,
        traitOpportunitySummary,
        ...boardChainDisplayState
    };
};
