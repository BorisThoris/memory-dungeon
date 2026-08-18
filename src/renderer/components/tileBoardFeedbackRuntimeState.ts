import { getFocusedTileLiveLabel } from './tileBoardDomAccessibility';
import { buildBoardLiveMessage } from './tileBoardFeedbackSummaryState';
import { buildTraitRewardHotText } from './tileBoardFeedbackState';

type TraitRewardHotTextArgs = Parameters<typeof buildTraitRewardHotText>[0];
type FocusedTileLiveLabelArgs = Parameters<typeof getFocusedTileLiveLabel>[0];
type BoardLiveMessageArgs = Parameters<typeof buildBoardLiveMessage>[0];

export const buildBoardFeedbackFocusState = ({
    chainContext,
    focusedTileLiveLabel,
    runStatus
}: {
    chainContext: TraitRewardHotTextArgs['chainContext'];
    focusedTileLiveLabel: Omit<FocusedTileLiveLabelArgs, 'traitRewardHotText'>;
    runStatus: TraitRewardHotTextArgs['runStatus'];
}) => {
    const traitRewardHotText = buildTraitRewardHotText({ chainContext, runStatus });
    const focusedTileLabel = getFocusedTileLiveLabel({
        ...focusedTileLiveLabel,
        traitRewardHotText
    });

    return {
        focusedTileLabel,
        traitRewardHotText
    };
};

export const buildBoardFeedbackLiveAnnouncementState = (
    state: BoardLiveMessageArgs
): string => buildBoardLiveMessage(state);

export const buildBoardChainOpportunityBeatSfxSignature = ({
    opportunity,
    runStatus
}: {
    opportunity: {
        beatSignal: { beatCount: number; tier: string } | null;
        nextActionId: string;
        nextTarget: string | null;
    };
    runStatus: string | undefined;
}): string | null => {
    const beatSignal = opportunity.beatSignal;
    if (!beatSignal || runStatus !== 'playing') {
        return null;
    }

    return [
        beatSignal.tier,
        beatSignal.beatCount,
        opportunity.nextActionId,
        opportunity.nextTarget ?? 'none'
    ].join(':');
};
