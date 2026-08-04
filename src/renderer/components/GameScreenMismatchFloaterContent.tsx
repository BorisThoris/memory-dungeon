import type { CSSProperties } from 'react';
import { mismatchFloaterVisualLabel } from '../copy/mismatchFloater';
import {
    getMismatchRecoveryLaneAudioCue,
    getMismatchRecoveryLaneBeatCount,
    getMismatchRecoveryLaneScreenCue,
    getMismatchRecoveryChipAudioCue,
    getMismatchRecoveryChipBeatCount,
    getMismatchRecoveryChipScreenCue,
    mismatchRecoveryLaneAction,
    mismatchRecoveryLaneActionMapAttr,
    mismatchRecoveryLaneMapAttr,
    mismatchRecoveryLaneMapLabel
} from './gameScreenBoardModels';
import styles from './GameScreen.module.css';
import type { GameScreenBoardFloaterProjection } from './useGameScreenBoardFloaterProjection';

export const GameScreenMismatchFloaterContent = ({
    projection
}: {
    projection: GameScreenBoardFloaterProjection;
}) => {
    const {
        boardFloaterPayload,
        boardFloaterDetailLines,
        boardFloaterMismatchRecovery,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterMismatchRecoveryCrescendoLabel,
        boardFloaterMismatchRecoveryBurst,
        boardFloaterMismatchRecoveryBurstFill,
        boardFloaterMismatchNextAction,
        boardFloaterMismatchRecoveryChips,
        boardFloaterMismatchRecoveryLaneMap,
        boardFloaterPrimaryMismatchRecoveryLane,
        boardFloaterMismatchRecoveryLaneMapFill,
        boardFloaterPrimaryMismatchRecoveryLaneFill,
        boardFloaterMismatchRecoveryStack,
        boardFloaterMismatchRecoverySequence
    } = projection;

    if (boardFloaterPayload?.kind !== 'miss') return null;

    return (
        <>
            <span className={styles.boardFloaterMain}>
                {mismatchFloaterVisualLabel(boardFloaterDetailLines, {
                    brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                    brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
                })}
            </span>
            {boardFloaterDetailLines.slice(0, 2).map((line) => (
                <span className={styles.boardFloaterTraitLine} key={line}>
                    {line}
                </span>
            ))}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecovery ? (
                <span
                    className={styles.boardFloaterRecoveryHint}
                    data-testid="mismatch-score-floater-recovery"
                >
                    {boardFloaterMismatchRecovery}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchNextAction ? (
                <span
                    aria-label={`${boardFloaterMismatchNextAction.arcadeCue}: ${boardFloaterMismatchNextAction.label}: ${boardFloaterMismatchNextAction.value}`}
                    className={styles.boardFloaterNextAction}
                    data-mismatch-next-action-cue={boardFloaterMismatchNextAction.arcadeCue}
                    data-mismatch-next-action={boardFloaterMismatchNextAction.tone}
                    data-testid="mismatch-score-floater-next-action"
                >
                    <em>{boardFloaterMismatchNextAction.arcadeCue}</em>
                    <small>{boardFloaterMismatchNextAction.label}</small>
                    <b>{boardFloaterMismatchNextAction.value}</b>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryBurst ? (
                <span
                    aria-label={`${boardFloaterMismatchRecoveryBurst.label}: ${boardFloaterMismatchRecoveryBurst.value}`}
                    className={styles.boardFloaterRecoveryBurst}
                    data-recovery-burst-tier={boardFloaterMismatchRecoveryBurst.tier}
                    data-recovery-burst-fill={boardFloaterMismatchRecoveryBurstFill}
                    style={
                        {
                            '--recovery-burst-fill': `${boardFloaterMismatchRecoveryBurstFill}%`
                        } as CSSProperties
                    }
                    data-testid="mismatch-score-floater-recovery-burst"
                >
                    <small>{boardFloaterMismatchRecoveryBurst.label}</small>
                    <b>{boardFloaterMismatchRecoveryBurst.value}</b>
                    <span aria-hidden="true" className={styles.boardFloaterRecoveryBurstMeter} />
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryCrescendo ? (
                <span
                    aria-label={boardFloaterMismatchRecoveryCrescendoLabel}
                    className={styles.boardFloaterRecoveryCrescendo}
                    data-mismatch-recovery-crescendo-screen-cue={
                        boardFloaterMismatchRecoveryCrescendo.screenCue
                    }
                    data-mismatch-recovery-crescendo-tier={
                        boardFloaterMismatchRecoveryCrescendo.tier
                    }
                    data-testid="mismatch-score-floater-recovery-crescendo"
                >
                    <small>{boardFloaterMismatchRecoveryCrescendo.label}</small>
                    <strong>
                        {Array.from({ length: boardFloaterMismatchRecoveryCrescendo.beatCount }).map(
                            (_, index) => (
                                <i aria-hidden="true" key={`mismatch-recovery-beat-${index}`} />
                            )
                        )}
                    </strong>
                    <em>{boardFloaterMismatchRecoveryCrescendo.detail}</em>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryStack ? (
                <span
                    aria-label={`${boardFloaterMismatchRecoveryStack.label}: ${boardFloaterMismatchRecoveryStack.value}. ${boardFloaterMismatchRecoveryStack.detail}`}
                    className={styles.boardFloaterRecoveryStack}
                    data-mismatch-recovery-stack={boardFloaterMismatchRecoveryStack.tone}
                    data-testid="mismatch-score-floater-recovery-stack"
                >
                    <small>{boardFloaterMismatchRecoveryStack.label}</small>
                    <b>{boardFloaterMismatchRecoveryStack.value}</b>
                    <em>{boardFloaterMismatchRecoveryStack.detail}</em>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoverySequence ? (
                <span
                    aria-label={`${boardFloaterMismatchRecoverySequence.label}. First: ${boardFloaterMismatchRecoverySequence.first}. Then: ${boardFloaterMismatchRecoverySequence.then}. Keep: ${boardFloaterMismatchRecoverySequence.keep}.`}
                    className={styles.boardFloaterRecoverySequence}
                    data-mismatch-recovery-sequence={boardFloaterMismatchRecoverySequence.tone}
                    data-mismatch-sequence-first={boardFloaterMismatchRecoverySequence.first}
                    data-mismatch-sequence-keep={boardFloaterMismatchRecoverySequence.keep}
                    data-mismatch-sequence-then={boardFloaterMismatchRecoverySequence.then}
                    data-testid="mismatch-score-floater-recovery-sequence"
                >
                    <small>First</small>
                    <b>{boardFloaterMismatchRecoverySequence.first}</b>
                    <small>Then</small>
                    <b>{boardFloaterMismatchRecoverySequence.then}</b>
                    <small>Keep</small>
                    <b>{boardFloaterMismatchRecoverySequence.keep}</b>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryLaneMap ? (
                <span
                    aria-label={mismatchRecoveryLaneMapLabel(boardFloaterMismatchRecoveryLaneMap)}
                    className={styles.boardFloaterRecoveryLaneMap}
                    data-mismatch-recovery-lane-actions={mismatchRecoveryLaneActionMapAttr(
                        boardFloaterMismatchRecoveryLaneMap
                    )}
                    data-mismatch-recovery-lane-map-fill={boardFloaterMismatchRecoveryLaneMapFill}
                    data-mismatch-recovery-lane-map={mismatchRecoveryLaneMapAttr(boardFloaterMismatchRecoveryLaneMap)}
                    data-mismatch-recovery-primary-lane={boardFloaterPrimaryMismatchRecoveryLane?.id ?? 'none'}
                    data-mismatch-recovery-primary-lane-action={
                        boardFloaterPrimaryMismatchRecoveryLane
                            ? mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)
                            : 'none'
                    }
                    data-mismatch-recovery-primary-lane-audio={
                        boardFloaterPrimaryMismatchRecoveryLane
                            ? getMismatchRecoveryLaneAudioCue(boardFloaterPrimaryMismatchRecoveryLane)
                            : 'none'
                    }
                    data-mismatch-recovery-primary-lane-beats={
                        boardFloaterPrimaryMismatchRecoveryLane
                            ? getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane)
                            : 0
                    }
                    data-mismatch-recovery-primary-lane-cue={boardFloaterPrimaryMismatchRecoveryLane?.cue ?? 'none'}
                    data-mismatch-recovery-primary-lane-screen-cue={
                        boardFloaterPrimaryMismatchRecoveryLane
                            ? getMismatchRecoveryLaneScreenCue(boardFloaterPrimaryMismatchRecoveryLane)
                            : 'none'
                    }
                    style={
                        {
                            '--mismatch-recovery-lane-map-fill': `${boardFloaterMismatchRecoveryLaneMapFill}%`
                        } as CSSProperties
                    }
                    data-testid="mismatch-score-floater-recovery-lane-map"
                >
                    <span aria-hidden="true" className={styles.boardFloaterRecoveryLaneMapMeter} />
                    {boardFloaterPrimaryMismatchRecoveryLane ? (
                        <span
                            aria-label={`Primary recovery lane. ${boardFloaterPrimaryMismatchRecoveryLane.label}: ${mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)}. ${boardFloaterPrimaryMismatchRecoveryLane.cue}. ${getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane)} beats.`}
                            className={styles.boardFloaterRecoveryPrimaryLane}
                            data-mismatch-recovery-primary-lane={boardFloaterPrimaryMismatchRecoveryLane.id}
                            data-mismatch-recovery-primary-lane-action={mismatchRecoveryLaneAction(
                                boardFloaterPrimaryMismatchRecoveryLane
                            )}
                            data-mismatch-recovery-primary-lane-audio={getMismatchRecoveryLaneAudioCue(
                                boardFloaterPrimaryMismatchRecoveryLane
                            )}
                            data-mismatch-recovery-primary-lane-beats={getMismatchRecoveryLaneBeatCount(
                                boardFloaterPrimaryMismatchRecoveryLane
                            )}
                            data-mismatch-recovery-primary-lane-cue={boardFloaterPrimaryMismatchRecoveryLane.cue}
                            data-mismatch-recovery-primary-lane-screen-cue={getMismatchRecoveryLaneScreenCue(
                                boardFloaterPrimaryMismatchRecoveryLane
                            )}
                            data-mismatch-recovery-primary-lane-fill={boardFloaterPrimaryMismatchRecoveryLaneFill}
                            style={
                                {
                                    '--mismatch-recovery-primary-lane-fill': `${boardFloaterPrimaryMismatchRecoveryLaneFill}%`
                                } as CSSProperties
                            }
                            data-testid="mismatch-score-floater-primary-recovery-lane"
                        >
                            <small>Recovery focus</small>
                            <b>{boardFloaterPrimaryMismatchRecoveryLane.label}</b>
                            <strong>
                                {mismatchRecoveryLaneAction(boardFloaterPrimaryMismatchRecoveryLane)}
                            </strong>
                            <em>{boardFloaterPrimaryMismatchRecoveryLane.cue}</em>
                            <span
                                aria-hidden="true"
                                className={styles.boardFloaterRecoveryPrimaryLaneBeatPips}
                            >
                                {Array.from(
                                    {
                                        length: getMismatchRecoveryLaneBeatCount(
                                            boardFloaterPrimaryMismatchRecoveryLane
                                        )
                                    },
                                    (_, beatIndex) => (
                                        <i
                                            data-mismatch-recovery-primary-lane-beat={beatIndex + 1}
                                            key={beatIndex}
                                        />
                                    )
                                )}
                            </span>
                        </span>
                    ) : null}
                    {boardFloaterMismatchRecoveryLaneMap.map((lane) => (
                        <span
                            data-mismatch-recovery-lane={lane.id}
                            data-mismatch-recovery-lane-action={mismatchRecoveryLaneAction(lane)}
                            data-mismatch-recovery-lane-audio={getMismatchRecoveryLaneAudioCue(lane)}
                            data-mismatch-recovery-lane-beats={getMismatchRecoveryLaneBeatCount(lane)}
                            data-mismatch-recovery-lane-count={lane.count}
                            data-mismatch-recovery-lane-screen-cue={getMismatchRecoveryLaneScreenCue(lane)}
                            key={lane.id}
                        >
                            <small>{lane.label}</small>
                            <b>{lane.count}</b>
                            <strong>{mismatchRecoveryLaneAction(lane)}</strong>
                            <em>{lane.cue}</em>
                            <span
                                aria-hidden="true"
                                className={styles.boardFloaterRecoveryLaneBeatPips}
                            >
                                {Array.from(
                                    { length: getMismatchRecoveryLaneBeatCount(lane) },
                                    (_, beatIndex) => (
                                        <i
                                            data-mismatch-recovery-lane-beat={beatIndex + 1}
                                            key={beatIndex}
                                        />
                                    )
                                )}
                            </span>
                        </span>
                    ))}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'miss' && boardFloaterMismatchRecoveryChips.length > 0 ? (
                <span
                    className={styles.boardFloaterRecoveryChips}
                    data-testid="mismatch-score-floater-recovery-chips"
                >
                    {boardFloaterMismatchRecoveryChips.map((chip) => {
                        const chipBeatCount = getMismatchRecoveryChipBeatCount(chip);
                        const chipFill = Math.min(100, (chipBeatCount / 4) * 100);
                        
                        return (
                            <span
                                aria-label={`${chip.arcadeCue}: ${chip.label}: ${chip.value}`}
                                data-mismatch-recovery-chip={chip.tone}
                                data-mismatch-recovery-chip-audio={getMismatchRecoveryChipAudioCue(chip)}
                                data-mismatch-recovery-chip-beats={chipBeatCount}
                                data-mismatch-recovery-chip-fill={chipFill}
                                data-mismatch-recovery-chip-cue={chip.arcadeCue}
                                data-mismatch-recovery-chip-screen-cue={getMismatchRecoveryChipScreenCue(chip)}
                                data-mismatch-recovery-urgency={chip.urgency ?? 'none'}
                                key={chip.id}
                                style={
                                    {
                                        '--mismatch-recovery-chip-fill': `${chipFill}%`
                                    } as CSSProperties
                                }
                            >
                                <em>{chip.arcadeCue}</em>
                                <small>{chip.label}</small>
                                <b>{chip.value}</b>
                                <span
                                    aria-hidden="true"
                                    className={styles.boardFloaterRecoveryChipMeter}
                                />
                                <span className={styles.boardFloaterChipBeats} aria-hidden="true">
                                    {Array.from({ length: chipBeatCount }, (_, index) => (
                                        <i
                                            data-mismatch-recovery-chip-beat={index + 1}
                                            key={`mismatch-recovery-chip-beat-${chip.id}-${index + 1}`}
                                        />
                                    ))}
                                </span>
                            </span>
                        );
                    })}
                </span>
            ) : null}
        </>
    );
};

