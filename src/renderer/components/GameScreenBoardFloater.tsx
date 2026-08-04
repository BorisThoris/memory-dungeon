import type { CSSProperties, RefObject } from 'react';
import {
    getBoardFloaterJackpotAudioCue,
    getBoardFloaterJackpotScreenCue,
    getMatchFloaterHeat,
    getMismatchFloaterHeat
} from './gameScreenBoardModels';
import { GameScreenMatchFloaterContent } from './GameScreenMatchFloaterContent';
import { GameScreenMismatchFloaterContent } from './GameScreenMismatchFloaterContent';
import styles from './GameScreen.module.css';
import type { GameScreenBoardFloaterProjection } from './useGameScreenBoardFloaterProjection';

export const GameScreenBoardFloater = ({
    boardFloaterRef,
    boardFloaterPos,
    projection
}: {
    boardFloaterRef: RefObject<HTMLDivElement | null>;
    boardFloaterPos: { x: number; y: number } | null;
    projection: GameScreenBoardFloaterProjection;
}) => {
    const {
        reduceMotion,
        boardFloaterPayload,
        boardFloaterDurationMs,
        boardFloaterDetailLines,
        boardFloaterTraitLaneMap,
        boardFloaterTraitLaneMapAttr,
        boardFloaterMismatchSignal,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterLiveText,
        boardFloaterJackpotCue
    } = projection;

    return (
        <>
            {boardFloaterPayload ? (
                <span
                    key={`live-${boardFloaterPayload.key}`}
                    aria-atomic="true"
                    aria-live="polite"
                    className={styles.srOnly}
                >
                    {boardFloaterLiveText}
                </span>
            ) : null}
            {boardFloaterPos && boardFloaterPayload ? (
                <div
                    ref={boardFloaterRef}
                    key={boardFloaterPayload.key}
                    aria-hidden
                    className={`${
                        boardFloaterPayload.kind === 'match'
                            ? styles.matchScoreFloater
                            : styles.mismatchScoreFloater
                    } ${reduceMotion ? styles.matchScoreFloaterReduced : ''}`}
                    data-testid={
                        boardFloaterPayload.kind === 'match'
                            ? 'match-score-floater'
                            : 'mismatch-score-floater'
                    }
                    data-feedback-intensity={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterPayload.feedbackIntensity
                            : boardFloaterDetailLines.length > 0
                              ? 'penalty'
                              : (boardFloaterPayload.brokenChainDepth ?? 0) >= 3
                                ? 'break'
                              : 'miss'
                    }
                    data-match-floater-heat={
                        boardFloaterPayload.kind === 'match'
                            ? getMatchFloaterHeat(boardFloaterPayload)
                            : 'none'
                    }
                    data-match-crescendo-audio={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterPayload.crescendo?.audioCue ?? 'none'
                            : 'none'
                    }
                    data-match-crescendo-beats={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterPayload.crescendo?.beatCount ?? 0
                            : 0
                    }
                    data-match-crescendo-cue={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                            : 'none'
                    }
                    data-match-crescendo-screen-cue={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterPayload.crescendo?.screenCue ?? 'none'
                            : 'none'
                    }
                    data-match-crescendo-tier={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterPayload.crescendo?.tier ?? 'none'
                            : 'none'
                    }
                    data-match-jackpot-beats={
                        boardFloaterPayload.kind === 'match' ? boardFloaterJackpotCue?.beatCount ?? 0 : 0
                    }
                    data-match-jackpot-audio={
                        boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue
                            ? getBoardFloaterJackpotAudioCue(boardFloaterJackpotCue)
                            : 'none'
                    }
                    data-match-jackpot-screen-cue={
                        boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue
                            ? getBoardFloaterJackpotScreenCue(boardFloaterJackpotCue)
                            : 'none'
                    }
                    data-match-jackpot-tier={
                        boardFloaterPayload.kind === 'match' ? boardFloaterJackpotCue?.tier ?? 'none' : 'none'
                    }
                    data-match-trait-lane-count={
                        boardFloaterPayload.kind === 'match' ? boardFloaterTraitLaneMap.length : 0
                    }
                    data-match-trait-lane-map={
                        boardFloaterPayload.kind === 'match'
                            ? boardFloaterTraitLaneMapAttr || 'none'
                            : 'none'
                    }
                    data-mismatch-floater-heat={
                        boardFloaterPayload.kind === 'miss'
                            ? getMismatchFloaterHeat(boardFloaterPayload)
                            : 'none'
                    }
                    data-mismatch-recovery-crescendo-beats={
                        boardFloaterPayload.kind === 'miss'
                            ? boardFloaterMismatchRecoveryCrescendo?.beatCount ?? 0
                            : 0
                    }
                    data-mismatch-recovery-crescendo-cue={
                        boardFloaterPayload.kind === 'miss'
                            ? boardFloaterMismatchRecoveryCrescendo?.screenCue ?? 'none'
                            : 'none'
                    }
                    data-mismatch-recovery-crescendo-screen-cue={
                        boardFloaterPayload.kind === 'miss'
                            ? boardFloaterMismatchRecoveryCrescendo?.screenCue ?? 'none'
                            : 'none'
                    }
                    data-mismatch-recovery-crescendo-tier={
                        boardFloaterPayload.kind === 'miss'
                            ? boardFloaterMismatchRecoveryCrescendo?.tier ?? 'none'
                            : 'none'
                    }
                    style={
                        {
                            left: boardFloaterPos.x,
                            top: boardFloaterPos.y,
                            '--match-score-float-ms': `${boardFloaterDurationMs}ms`
                        } as CSSProperties
                    }
                >
                    {boardFloaterPayload.kind === 'match' ? (
                        <span
                            className={styles.boardFloaterSignal}
                            data-floater-signal={boardFloaterPayload.feedbackSignal.tone}
                        >
                            {boardFloaterPayload.feedbackSignal.label}
                        </span>
                    ) : (
                        <span
                            className={styles.boardFloaterSignal}
                            data-floater-signal={boardFloaterMismatchSignal?.tone}
                        >
                            {boardFloaterMismatchSignal?.label}
                        </span>
                    )}
                    {boardFloaterPayload.kind === 'match' ? (
                        <GameScreenMatchFloaterContent projection={projection} />
                    ) : (
                        <GameScreenMismatchFloaterContent projection={projection} />
                    )}
                </div>
            ) : null}
        </>
    );
};
