import type {
    BoardChainCueMeterState,
    BoardChainOpportunityPriorityId
} from './tileBoardFeedbackCues';
import type { BoardChainAccessibilitySummaryState } from './tileBoardChainDisplayState';
import type {
    BoardChainOpportunityState,
    BoardChainSequenceCueState,
    BoardOpportunityCompassRowState,
    BoardPayoffStackState,
    BoardRewardLadderState,
    BoardTraitModeCueState
} from './tileBoardFeedbackState';

const trimTerminalPunctuation = (value: string): string => value.trim().replace(/[.!?]+$/u, '');

export interface BoardChainFeedbackSummaryState {
    cueMeterFill: number;
    cueMeterState: BoardChainCueMeterState;
    nextActionMeterFill: number;
    nextActionTier: 'now' | 'prime' | 'route' | 'setup' | 'tap';
    nextActionVerb: 'Match' | 'Now' | 'Prime' | 'Setup' | 'Tap';
    priorityId: BoardChainOpportunityPriorityId;
    sequenceAccessibleLabel: string | null;
}

export const buildBoardChainFeedbackSummaryState = ({
    opportunity,
    sequenceCue
}: {
    opportunity: BoardChainOpportunityState;
    sequenceCue: BoardChainSequenceCueState | null;
}): BoardChainFeedbackSummaryState => {
    const nextActionMeterFill =
        opportunity.nextActionId === 'cashout'
            ? 100
            : opportunity.nextActionId === 'follow-up'
              ? 75
              : opportunity.nextActionId === 'prime-route'
                ? 50
                : 60;
    const nextActionTier =
        opportunity.nextActionId === 'cashout'
            ? 'now'
            : opportunity.nextActionId === 'follow-up'
              ? 'tap'
              : opportunity.nextActionId === 'match-route'
                ? 'route'
                : opportunity.nextActionId === 'prime-route'
                  ? 'prime'
                  : 'setup';
    const nextActionVerb =
        opportunity.nextActionId === 'cashout'
            ? 'Now'
            : opportunity.nextActionId === 'follow-up'
              ? 'Tap'
              : opportunity.nextActionId === 'match-route'
                ? 'Match'
                : opportunity.nextActionId === 'prime-route'
                  ? 'Prime'
                  : 'Setup';
    const cueMeterState: BoardChainCueMeterState =
        opportunity.rewardHot || opportunity.streakCashoutReady
            ? 'cashout'
            : opportunity.selectedFollowupCount > 0
              ? 'followup'
              : opportunity.comboSurgeLabel
                ? 'surge'
                : 'setup';
    const priorityId: BoardChainOpportunityPriorityId = opportunity.rewardHot
        ? 'best'
        : opportunity.selectedFollowupCount > 0
          ? 'followup'
          : opportunity.tone;
    const cueMeterFill =
        cueMeterState === 'cashout' ? 100 : cueMeterState === 'followup' ? 75 : cueMeterState === 'surge' ? 60 : 40;

    return {
        cueMeterFill,
        cueMeterState,
        nextActionMeterFill,
        nextActionTier,
        nextActionVerb,
        priorityId,
        sequenceAccessibleLabel: sequenceCue
            ? `Chain sequence. First: ${trimTerminalPunctuation(sequenceCue.first)}. Then: ${trimTerminalPunctuation(
                  sequenceCue.then
              )}. Keep: ${trimTerminalPunctuation(sequenceCue.keep)}.`
            : null
    };
};

export const buildBoardLiveMessage = ({
    boardChainAccessibilitySummary,
    boardOpportunityCompassRows,
    boardOpportunityLaneMapLiveText,
    boardPayoffStack,
    focusedTileLabel,
    rewardLead,
    traitModeCue
}: {
    boardChainAccessibilitySummary: BoardChainAccessibilitySummaryState;
    boardOpportunityCompassRows: BoardOpportunityCompassRowState[];
    boardOpportunityLaneMapLiveText: string;
    boardPayoffStack: BoardPayoffStackState | null;
    focusedTileLabel: string | null;
    rewardLead: BoardRewardLadderState['lead'];
    traitModeCue: BoardTraitModeCueState | null;
}): string => {
    if (!focusedTileLabel) {
        return '';
    }
    const stackLiveText = boardPayoffStack
        ? ` Board stack: ${boardPayoffStack.cue}. ${boardPayoffStack.action}. ${boardPayoffStack.value}. ${boardPayoffStack.detail}. ${boardPayoffStack.crescendo.label}. ${boardPayoffStack.crescendo.detail}. ${boardPayoffStack.nextCue}.${
              boardPayoffStack.sequenceCue ? ` ${boardPayoffStack.sequenceCue}.` : ''
          } Keep: ${boardPayoffStack.sequence.keep}.`
        : '';
    const bestOpportunity = boardOpportunityCompassRows[0];
    const bestOpportunityLiveText = bestOpportunity
        ? ` Best play: ${bestOpportunity.impactCue}. ${bestOpportunity.label}: ${bestOpportunity.value}. ${bestOpportunity.action}: ${bestOpportunity.detail}.`
        : '';
    const rewardLeadLiveText = rewardLead
        ? ` Next reward: ${rewardLead.label}. ${rewardLead.action}. ${rewardLead.progressLabel}. ${rewardLead.remainingLabel}.`
        : '';
    const traitModeLiveText = traitModeCue
        ? ` Trait mode: ${traitModeCue.value}.${traitModeCue.nextReward ? ` ${traitModeCue.nextReward}.` : ''} ${traitModeCue.detail}.`
        : '';
    const chainLiveText =
        boardChainAccessibilitySummary.tone === 'idle' ? '' : ` ${boardChainAccessibilitySummary.label}`;

    return `Focus: ${focusedTileLabel}${bestOpportunityLiveText}${rewardLeadLiveText}${traitModeLiveText}${boardOpportunityLaneMapLiveText}${stackLiveText}${chainLiveText}`;
};
