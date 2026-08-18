import { useEffect, useMemo, useRef, useState } from 'react';
import type { BoardState } from '../../shared/contracts';
import { playChainOpportunityBeatSfx, resumeAudioContext } from '../audio/gameSfx';
import type { buildBoardFeedbackModelState } from './tileBoardFeedbackModelState';
import { buildBoardChainOpportunityBeatSfxSignature } from './tileBoardFeedbackRuntimeState';
import {
    buildLastResolutionFeedback,
    buildTrapResolutionAnnouncement,
    shouldClearTrapResolutionAnnouncement,
    type TileBoardTrapResolutionDetails
} from './tileBoardResolutionFeedbackState';

interface TileBoardFeedbackRuntimeArgs {
    board: BoardState;
    boardFeedbackModelState: Pick<
        ReturnType<typeof buildBoardFeedbackModelState>,
        | 'boardChainOpportunity'
    >;
    resolvedTrapTileCount: number;
    runStatus: string | undefined;
    shuffleSfxGain: number;
}

export const useTileBoardFeedbackRuntime = ({
    board,
    boardFeedbackModelState,
    resolvedTrapTileCount,
    runStatus,
    shuffleSfxGain
}: TileBoardFeedbackRuntimeArgs) => {
    const [trapResolutionMessage, setTrapResolutionMessage] = useState('');
    const [trapResolutionDetails, setTrapResolutionDetails] = useState<TileBoardTrapResolutionDetails | null>(null);
    const [lastResolutionFeedback, setLastResolutionFeedback] = useState('');
    const previousResolvedTrapTileCountRef = useRef<number | null>(null);
    const chainOpportunityBeatSfxSignatureRef = useRef<string | null>(null);

    const boardChainOpportunityBeatSfxSignature = useMemo(
        () =>
            buildBoardChainOpportunityBeatSfxSignature({
                opportunity: boardFeedbackModelState.boardChainOpportunity,
                runStatus
            }),
        [boardFeedbackModelState.boardChainOpportunity, runStatus]
    );

    useEffect(() => {
        const previous = previousResolvedTrapTileCountRef.current;
        previousResolvedTrapTileCountRef.current = resolvedTrapTileCount;
        const announcement = buildTrapResolutionAnnouncement({
            board,
            previousResolvedTrapTileCount: previous,
            resolvedTrapTileCount
        });
        if (!announcement) {
            return;
        }
        queueMicrotask(() => {
            setTrapResolutionMessage(announcement.message);
            setTrapResolutionDetails(announcement.details);
        });
    }, [board, resolvedTrapTileCount]);

    useEffect(() => {
        if (!shouldClearTrapResolutionAnnouncement({ resolvedTrapTileCount, trapResolutionMessage })) {
            return;
        }
        queueMicrotask(() => {
            setTrapResolutionMessage('');
            setTrapResolutionDetails(null);
        });
    }, [resolvedTrapTileCount, trapResolutionMessage]);

    useEffect(() => {
        const next = buildLastResolutionFeedback({ board, runStatus });
        if (next) {
            // Keep the reduced-motion feedback test hook in lockstep with resolution state.
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLastResolutionFeedback(next);
        }
    }, [board, runStatus]);

    useEffect(() => {
        if (!boardChainOpportunityBeatSfxSignature || !boardFeedbackModelState.boardChainOpportunity.beatSignal) {
            chainOpportunityBeatSfxSignatureRef.current = null;
            return;
        }
        if (chainOpportunityBeatSfxSignatureRef.current === boardChainOpportunityBeatSfxSignature) {
            return;
        }
        chainOpportunityBeatSfxSignatureRef.current = boardChainOpportunityBeatSfxSignature;
        void resumeAudioContext();
        playChainOpportunityBeatSfx(
            shuffleSfxGain,
            boardFeedbackModelState.boardChainOpportunity.beatSignal.tier,
            boardFeedbackModelState.boardChainOpportunity.beatSignal.beatCount
        );
    }, [
        boardChainOpportunityBeatSfxSignature,
        boardFeedbackModelState.boardChainOpportunity.beatSignal,
        shuffleSfxGain
    ]);

    return {
        lastResolutionFeedback,
        trapResolutionDetails,
        trapResolutionMessage
    };
};
