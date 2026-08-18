import { useEffect } from 'react';
import type { buildBoardFeedbackModelState } from './tileBoardFeedbackModelState';
import type { buildBoardFeedbackSurfaceComposition } from './tileBoardFeedbackSurfaceComposition';
import { buildBoardFeedbackLiveAnnouncementState } from './tileBoardFeedbackRuntimeState';

interface TileBoardLiveAnnouncementArgs {
    announceBoardLiveMessage: (message: string) => void;
    boardFeedbackModelState: Pick<
        ReturnType<typeof buildBoardFeedbackModelState>,
        'boardChainAccessibilitySummary' | 'boardOpportunityCompassRows' | 'boardRewardLadderState' | 'boardTraitModeCue'
    >;
    boardOpportunityLaneMapLiveText: ReturnType<typeof buildBoardFeedbackSurfaceComposition>['boardOpportunityLaneMapLiveText'];
    boardPayoffStack: ReturnType<typeof buildBoardFeedbackSurfaceComposition>['boardPayoffStack'];
    focusedTileLabel: string | null;
}

export const useTileBoardLiveAnnouncement = ({
    announceBoardLiveMessage,
    boardFeedbackModelState,
    boardOpportunityLaneMapLiveText,
    boardPayoffStack,
    focusedTileLabel
}: TileBoardLiveAnnouncementArgs): void => {
    useEffect(() => {
        queueMicrotask(() => {
            announceBoardLiveMessage(
                buildBoardFeedbackLiveAnnouncementState({
                    boardChainAccessibilitySummary: boardFeedbackModelState.boardChainAccessibilitySummary,
                    boardOpportunityCompassRows: boardFeedbackModelState.boardOpportunityCompassRows,
                    boardOpportunityLaneMapLiveText,
                    boardPayoffStack,
                    focusedTileLabel,
                    rewardLead: boardFeedbackModelState.boardRewardLadderState.lead,
                    traitModeCue: boardFeedbackModelState.boardTraitModeCue
                })
            );
        });
    }, [
        announceBoardLiveMessage,
        boardFeedbackModelState,
        boardOpportunityLaneMapLiveText,
        boardPayoffStack,
        focusedTileLabel
    ]);
};
