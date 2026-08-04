import type { CSSProperties } from 'react';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import {
    getChainRewardLaneAction,
    getChainRewardProgress,
    getChainRewardStackLabel,
    getChainRewardUrgencyCopy
} from '../copy/chainMomentum';
import {
    formatTraitInteractionLaneMapLabel,
    getTraitInteractionLaneAction
} from '../copy/traitInteractionLaneMap';
import {
    getBoardFloaterCascadeBeatCount,
    getBoardFloaterChainMilestoneBeatCount,
    getBoardFloaterImpactCueBeatCount,
    getBoardFloaterImpactCueScreenCue,
    getBoardFloaterJackpotAudioCue,
    getBoardFloaterJackpotScreenCue,
    getBoardFloaterPayoffLadderAudioCue,
    getBoardFloaterPayoffLadderBeatCount,
    getBoardFloaterPayoffLadderScreenCue,
    getBoardFloaterPayoffLaneAudioCue,
    getBoardFloaterPayoffLaneBeatCount,
    getBoardFloaterPayoffLaneFocus,
    getBoardFloaterPayoffLaneScreenCue,
    getBoardFloaterPayoffSummaryAudioCue,
    getBoardFloaterPayoffSummaryBeatCount,
    getBoardFloaterPayoffSummaryScreenCue,
    getBoardFloaterRewardBurstAudioCue,
    getBoardFloaterRewardBurstBeatCount,
    getBoardFloaterRewardBurstScreenCue,
    getBoardFloaterRewardForecastAudioCue,
    getBoardFloaterRewardForecastBeatCount,
    getBoardFloaterRewardForecastScreenCue,
    getBoardFloaterTraitLaneAudioCue,
    getBoardFloaterTraitLaneBeatCount,
    getBoardFloaterTraitLaneScreenCue,
    getMatchPayoffChipAudioCue,
    getMatchPayoffChipBeatCount,
    getMatchPayoffChipScreenCue,
    matchPayoffLaneAction,
    matchPayoffLaneActionMapAttr,
    matchPayoffLaneMapAttr,
    matchPayoffLaneMapLabel
} from './gameScreenBoardModels';
import styles from './GameScreen.module.css';
import type { GameScreenBoardFloaterProjection } from './useGameScreenBoardFloaterProjection';

export const GameScreenMatchFloaterContent = ({
    projection
}: {
    projection: GameScreenBoardFloaterProjection;
}) => {
    const {
        boardFloaterPayload,
        boardFloaterMatchPayoffChips,
        boardFloaterMatchPayoffLaneMap,
        boardFloaterMatchChainRewardForecastCues,
        boardFloaterMatchPayoffLadder,
        boardFloaterDetailLines,
        boardFloaterTraitLaneMap,
        boardFloaterTraitLaneMapAttr,
        boardFloaterTraitLaneActionMapAttr,
        boardFloaterPrimaryTraitLane,
        boardFloaterTraitLaneMapSummaryFill,
        boardFloaterPrimaryTraitLaneFill,
        boardFloaterChainCue,
        boardFloaterJackpotCue,
        boardFloaterPrimaryPayoffLane,
        boardFloaterChainMilestoneFill,
        boardFloaterRewardBurstFill
    } = projection;

    if (boardFloaterPayload?.kind !== 'match') return null;

    return (
        <>
            {boardFloaterPayload.kind === 'match' && boardFloaterJackpotCue ? (
                <span
                    aria-label={`${boardFloaterJackpotCue.label}: ${boardFloaterJackpotCue.action}: ${boardFloaterJackpotCue.value}. ${boardFloaterJackpotCue.beatCount} beats.`}
                    className={styles.boardFloaterJackpotCue}
                    data-match-jackpot-action={boardFloaterJackpotCue.action}
                    data-match-jackpot-audio={getBoardFloaterJackpotAudioCue(boardFloaterJackpotCue)}
                    data-match-jackpot-beats={boardFloaterJackpotCue.beatCount}
                    data-match-jackpot-screen-cue={getBoardFloaterJackpotScreenCue(boardFloaterJackpotCue)}
                    data-match-jackpot-tier={boardFloaterJackpotCue.tier}
                    data-testid="match-score-floater-jackpot"
                >
                    <small>{boardFloaterJackpotCue.label}</small>
                    <b>{boardFloaterJackpotCue.action}</b>
                    <em>{boardFloaterJackpotCue.value}</em>
                    <span aria-hidden="true" className={styles.boardFloaterJackpotBeats}>
                        {Array.from({ length: boardFloaterJackpotCue.beatCount }, (_, index) => (
                            <i
                                data-match-jackpot-beat={index + 1}
                                data-match-jackpot-beat-focus={index === 0 ? 'primary' : 'support'}
                                key={`match-jackpot-beat-${index + 1}`}
                            />
                        ))}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' ? (
                <span
                    aria-label={`Match impact cue: ${boardFloaterPayload.impactCue.label}`}
                    className={styles.boardFloaterImpactCue}
                    data-match-impact-cue-beats={getBoardFloaterImpactCueBeatCount(boardFloaterPayload)}
                    data-match-impact-cue-screen-cue={getBoardFloaterImpactCueScreenCue(boardFloaterPayload)}
                    data-match-impact-cue-tone={boardFloaterPayload.impactCue.tone}
                    data-testid="match-score-floater-impact-cue"
                >
                    {boardFloaterPayload.impactCue.label}
                    <span aria-hidden="true" className={styles.boardFloaterImpactBeatPips}>
                        {Array.from(
                            { length: getBoardFloaterImpactCueBeatCount(boardFloaterPayload) },
                            (_, index) => (
                                <i
                                    data-match-impact-cue-beat={index + 1}
                                    data-match-impact-cue-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`match-impact-cue-beat-${index + 1}`}
                                />
                            )
                        )}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterPayload.crescendo ? (
                <span
                    aria-label={`Match crescendo ${boardFloaterPayload.crescendo.label}: ${boardFloaterPayload.crescendo.detail}. ${boardFloaterPayload.crescendo.beatCount} beats.`}
                    className={styles.boardFloaterCrescendo}
                    data-match-crescendo-cue={boardFloaterPayload.crescendo.screenCue}
                    data-match-crescendo-screen-cue={boardFloaterPayload.crescendo.screenCue}
                    data-match-crescendo-tier={boardFloaterPayload.crescendo.tier}
                    data-testid="match-score-floater-crescendo"
                >
                    <small>{boardFloaterPayload.crescendo.label}</small>
                    <span className={styles.boardFloaterCrescendoBeats}>
                        {Array.from({ length: boardFloaterPayload.crescendo.beatCount }, (_, index) => (
                            <i
                                aria-hidden
                                data-match-crescendo-beat={index + 1}
                                data-match-crescendo-beat-focus={index === 0 ? 'primary' : 'support'}
                                key={`crescendo-beat-${index + 1}`}
                            />
                        ))}
                    </span>
                    <b>{boardFloaterPayload.crescendo.detail}</b>
                </span>
            ) : null}
            <span className={styles.boardFloaterMain}>{boardFloaterPayload.feedbackHeadline}</span>
            {boardFloaterPayload.kind === 'match' && boardFloaterPayload.cascadeCue ? (
                <span
                    aria-label={`${boardFloaterPayload.cascadeCue.label}: ${boardFloaterPayload.cascadeCue.value}`}
                    className={styles.boardFloaterCascadeCue}
                    data-cascade-beats={getBoardFloaterCascadeBeatCount(boardFloaterPayload.cascadeCue)}
                    data-cascade-tier={boardFloaterPayload.cascadeCue.tier}
                    data-testid="match-score-floater-cascade"
                >
                    <small>{boardFloaterPayload.cascadeCue.label}</small>
                    <b>{boardFloaterPayload.cascadeCue.value}</b>
                    <span aria-hidden="true" className={styles.boardFloaterCascadeBeatPips}>
                        {Array.from(
                            { length: getBoardFloaterCascadeBeatCount(boardFloaterPayload.cascadeCue) },
                            (_, index) => (
                                <i
                                    data-cascade-beat={index + 1}
                                    data-cascade-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`cascade-beat-${index + 1}`}
                                />
                            )
                        )}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterPayload.chainMilestone ? (
                <span
                    aria-label={`Chain milestone ${boardFloaterPayload.chainMilestone.label}: ${boardFloaterPayload.chainMilestone.target}. Action: ${boardFloaterPayload.chainMilestone.action}. ${boardFloaterPayload.chainMilestone.value}. ${getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone)} beats.`}
                    className={styles.boardFloaterChainMilestone}
                    data-chain-milestone-action={boardFloaterPayload.chainMilestone.action}
                    data-chain-milestone-audio={boardFloaterPayload.chainMilestone.audioCue}
                    data-chain-milestone-beats={getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone)}
                    data-chain-milestone-fill={boardFloaterChainMilestoneFill}
                    data-chain-milestone-cue={boardFloaterPayload.chainMilestone.screenCue}
                    data-chain-milestone-screen-cue={boardFloaterPayload.chainMilestone.screenCue}
                    data-chain-milestone-target={boardFloaterPayload.chainMilestone.target}
                    data-chain-milestone-tone={boardFloaterPayload.chainMilestone.tone}
                    style={
                        {
                            '--chain-milestone-fill': `${boardFloaterChainMilestoneFill}%`
                        } as CSSProperties
                    }
                    data-testid="match-score-floater-chain-milestone"
                >
                    <small>{boardFloaterPayload.chainMilestone.label}</small>
                    <b>{boardFloaterPayload.chainMilestone.target}</b>
                    <strong>{boardFloaterPayload.chainMilestone.action}</strong>
                    <em>{boardFloaterPayload.chainMilestone.value}</em>
                    <span aria-hidden="true" className={styles.boardFloaterChainMilestoneMeter} />
                    <span aria-hidden="true" className={styles.boardFloaterChainMilestoneBeatPips}>
                        {Array.from(
                            { length: getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone) },
                            (_, index) => (
                                <i
                                    data-chain-milestone-beat={index + 1}
                                    data-chain-milestone-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`chain-milestone-beat-${index + 1}`}
                                />
                            )
                        )}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterPayload.rewardBurst ? (
                <span
                    aria-label={`${boardFloaterPayload.rewardBurst.label}: ${boardFloaterPayload.rewardBurst.action}: ${boardFloaterPayload.rewardBurst.value}`}
                    className={styles.boardFloaterRewardBurst}
                    data-reward-burst-action={boardFloaterPayload.rewardBurst.action}
                    data-reward-burst-audio={getBoardFloaterRewardBurstAudioCue(boardFloaterPayload.rewardBurst)}
                    data-reward-burst-beats={getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst)}
                    data-reward-burst-fill={boardFloaterRewardBurstFill}
                    data-reward-burst-label={boardFloaterPayload.rewardBurst.label}
                    data-reward-burst-screen-cue={getBoardFloaterRewardBurstScreenCue(boardFloaterPayload.rewardBurst)}
                    data-reward-burst-tier={boardFloaterPayload.rewardBurst.tier}
                    style={
                        {
                            '--reward-burst-fill': `${boardFloaterRewardBurstFill}%`
                        } as CSSProperties
                    }
                    data-testid="match-score-floater-reward-burst"
                >
                    <small>{boardFloaterPayload.rewardBurst.label}</small>
                    <u>{boardFloaterPayload.rewardBurst.action}</u>
                    <b>{boardFloaterPayload.rewardBurst.value}</b>
                    <span aria-hidden="true" className={styles.boardFloaterRewardBurstMeter} />
                    <span aria-hidden="true" className={styles.boardFloaterRewardBurstBeatPips}>
                        {Array.from(
                            { length: getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst) },
                            (_, index) => (
                                <i
                                    data-reward-burst-beat={index + 1}
                                    data-reward-burst-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`reward-burst-beat-${index + 1}`}
                                />
                            )
                        )}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterPayload.payoffSummary ? (
                <span
                    aria-label={`${boardFloaterPayload.payoffSummary.label}: ${boardFloaterPayload.payoffSummary.value}`}
                    className={styles.boardFloaterPayoffSummary}
                    data-payoff-summary-audio={getBoardFloaterPayoffSummaryAudioCue(boardFloaterPayload.payoffSummary)}
                    data-payoff-summary-beats={getBoardFloaterPayoffSummaryBeatCount(boardFloaterPayload.payoffSummary)}
                    data-payoff-summary-label={boardFloaterPayload.payoffSummary.label}
                    data-payoff-summary-focus={
                        boardFloaterPayload.payoffSummary.label === 'Super stack' ||
                        boardFloaterPayload.payoffSummary.label === 'Stack cashout'
                            ? 'cashout'
                            : boardFloaterPayload.payoffSummary.tier
                    }
                    data-payoff-summary-screen-cue={getBoardFloaterPayoffSummaryScreenCue(boardFloaterPayload.payoffSummary)}
                    data-payoff-summary-tier={boardFloaterPayload.payoffSummary.tier}
                    data-testid="match-score-floater-payoff-summary"
                >
                    <small>{boardFloaterPayload.payoffSummary.label}</small>
                    <b>{boardFloaterPayload.payoffSummary.value}</b>
                    <span aria-hidden="true" className={styles.boardFloaterPayoffSummaryBeatPips}>
                        {Array.from(
                            { length: getBoardFloaterPayoffSummaryBeatCount(boardFloaterPayload.payoffSummary) },
                            (_, index) => (
                                <i
                                    data-payoff-summary-beat={index + 1}
                                    data-payoff-summary-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`payoff-summary-beat-${index + 1}`}
                                />
                            )
                        )}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterMatchPayoffLaneMap.length > 0 ? (
                <span
                    aria-label={matchPayoffLaneMapLabel(boardFloaterMatchPayoffLaneMap)}
                    className={styles.boardFloaterPayoffLaneMap}
                    data-match-payoff-lane-primary={boardFloaterPrimaryPayoffLane?.id ?? 'none'}
                    data-match-payoff-lane-primary-action={
                        boardFloaterPrimaryPayoffLane
                            ? matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)
                            : 'none'
                    }
                    data-match-payoff-lane-primary-audio={
                        boardFloaterPrimaryPayoffLane
                            ? getBoardFloaterPayoffLaneAudioCue(boardFloaterPrimaryPayoffLane)
                            : 'none'
                    }
                    data-match-payoff-lane-primary-focus={
                        boardFloaterPrimaryPayoffLane
                            ? getBoardFloaterPayoffLaneFocus(boardFloaterPrimaryPayoffLane)
                            : 'none'
                    }
                    data-match-payoff-lane-actions={matchPayoffLaneActionMapAttr(
                        boardFloaterMatchPayoffLaneMap
                    )}
                    data-match-payoff-lane-map={matchPayoffLaneMapAttr(boardFloaterMatchPayoffLaneMap)}
                    data-match-payoff-lane-primary-screen-cue={
                        boardFloaterPrimaryPayoffLane
                            ? getBoardFloaterPayoffLaneScreenCue(boardFloaterPrimaryPayoffLane)
                            : 'none'
                    }
                    data-testid="match-score-floater-payoff-lane-map"
                >
                    <span
                        className={styles.boardFloaterPayoffLaneMapSummary}
                        data-match-payoff-lane-count={boardFloaterMatchPayoffLaneMap.length}
                        data-testid="match-score-floater-payoff-lane-map-summary"
                    >
                        <small>Lanes</small>
                        <b>
                            {boardFloaterMatchPayoffLaneMap.length}{' '}
                            {boardFloaterMatchPayoffLaneMap.length === 1 ? 'lane' : 'lanes'}
                        </b>
                        <span aria-hidden="true" className={styles.boardFloaterPayoffLaneMapSummaryBeatPips}>
                            {Array.from(
                                { length: Math.max(2, Math.min(5, boardFloaterMatchPayoffLaneMap.length + 1)) },
                                (_, index) => (
                                    <i
                                        data-match-payoff-lane-map-summary-beat={index + 1}
                                        data-match-payoff-lane-map-summary-beat-focus={
                                            index === 0 ? 'primary' : 'support'
                                        }
                                        key={`payoff-lane-map-summary-beat-${index + 1}`}
                                    />
                                )
                            )}
                        </span>
                    </span>
                    {boardFloaterPrimaryPayoffLane ? (
                        <span
                            aria-label={`Primary paid lane. ${matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)}: ${boardFloaterPrimaryPayoffLane.label}. ${boardFloaterPrimaryPayoffLane.cue}. ${getBoardFloaterPayoffLaneBeatCount(boardFloaterPrimaryPayoffLane)} beats.`}
                            data-match-payoff-primary-lane={boardFloaterPrimaryPayoffLane.id}
                            data-match-payoff-primary-lane-action={matchPayoffLaneAction(
                                boardFloaterPrimaryPayoffLane
                            )}
                            data-match-payoff-primary-lane-audio={getBoardFloaterPayoffLaneAudioCue(
                                boardFloaterPrimaryPayoffLane
                            )}
                            data-match-payoff-primary-lane-beats={getBoardFloaterPayoffLaneBeatCount(
                                boardFloaterPrimaryPayoffLane
                            )}
                            data-match-payoff-primary-lane-focus={getBoardFloaterPayoffLaneFocus(
                                boardFloaterPrimaryPayoffLane
                            )}
                            data-match-payoff-primary-lane-screen-cue={getBoardFloaterPayoffLaneScreenCue(
                                boardFloaterPrimaryPayoffLane
                            )}
                            data-match-payoff-primary-lane-tone={boardFloaterPrimaryPayoffLane.tone}
                            data-testid="match-score-floater-primary-payoff-lane"
                        >
                            <small>Paid lane</small>
                            <strong>{matchPayoffLaneAction(boardFloaterPrimaryPayoffLane)}</strong>
                            <em>{boardFloaterPrimaryPayoffLane.cue}</em>
                            <span aria-hidden="true" className={styles.boardFloaterPrimaryPayoffLaneBeatPips}>
                                {Array.from(
                                    { length: getBoardFloaterPayoffLaneBeatCount(boardFloaterPrimaryPayoffLane) },
                                    (_, index) => (
                                        <i
                                            data-match-payoff-primary-lane-beat={index + 1}
                                            data-match-payoff-primary-lane-beat-focus={
                                                index === 0 ? 'primary' : 'support'
                                            }
                                            key={`${boardFloaterPrimaryPayoffLane.id}-primary-payoff-lane-beat-${index + 1}`}
                                        />
                                    )
                                )}
                            </span>
                        </span>
                    ) : null}
                    {boardFloaterMatchPayoffLaneMap.map((lane) => (
                        <span
                            data-match-payoff-lane={lane.id}
                            data-match-payoff-lane-action={matchPayoffLaneAction(lane)}
                            data-match-payoff-lane-audio={getBoardFloaterPayoffLaneAudioCue(lane)}
                            data-match-payoff-lane-beats={getBoardFloaterPayoffLaneBeatCount(lane)}
                            data-match-payoff-lane-count={lane.count}
                            data-match-payoff-lane-screen-cue={getBoardFloaterPayoffLaneScreenCue(lane)}
                            data-match-payoff-lane-tone={lane.tone}
                            key={lane.id}
                        >
                            <small>{lane.label}</small>
                            {lane.count > 1 ? <b>x{lane.count}</b> : null}
                            <em>{lane.cue}</em>
                            <strong>{matchPayoffLaneAction(lane)}</strong>
                            <span aria-hidden="true" className={styles.boardFloaterPayoffLaneBeatPips}>
                                {Array.from({ length: getBoardFloaterPayoffLaneBeatCount(lane) }, (_, index) => (
                                    <i
                                        data-match-payoff-lane-beat={index + 1}
                                        data-match-payoff-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={`${lane.id}-payoff-lane-beat-${index + 1}`}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterMatchPayoffLadder ? (
                <span
                    aria-label={`Match payoff ladder. First: ${boardFloaterMatchPayoffLadder.first}. Then: ${boardFloaterMatchPayoffLadder.then}. Keep: ${boardFloaterMatchPayoffLadder.keep}.${
                        boardFloaterMatchPayoffLadder.lanes.length > 0
                            ? ` Lanes: ${boardFloaterMatchPayoffLadder.lanes.join(' to ')}.`
                            : ''
                    }`}
                    className={styles.boardFloaterPayoffLadder}
                    data-match-payoff-ladder-audio={getBoardFloaterPayoffLadderAudioCue(
                        boardFloaterMatchPayoffLadder
                    )}
                    data-match-payoff-ladder-beats={getBoardFloaterPayoffLadderBeatCount(
                        boardFloaterMatchPayoffLadder
                    )}
                    data-match-payoff-ladder-lanes={
                        boardFloaterMatchPayoffLadder.lanes.length > 0
                            ? boardFloaterMatchPayoffLadder.lanes.join('|')
                            : undefined
                    }
                    data-match-payoff-ladder-screen-cue={getBoardFloaterPayoffLadderScreenCue(
                        boardFloaterMatchPayoffLadder
                    )}
                    data-match-payoff-ladder-tone={boardFloaterMatchPayoffLadder.tone}
                    data-testid="match-score-floater-payoff-ladder"
                >
                    <span
                        className={styles.boardFloaterPayoffLadderSummary}
                        data-match-payoff-ladder-count={boardFloaterMatchPayoffLadder.lanes.length}
                        data-testid="match-score-floater-payoff-ladder-summary"
                    >
                        <small>Ladder</small>
                        <b>
                            {boardFloaterMatchPayoffLadder.lanes.length > 0
                                ? `${boardFloaterMatchPayoffLadder.lanes.length} lanes`
                                : 'No lanes'}
                        </b>
                        <span aria-hidden="true" className={styles.boardFloaterPayoffLadderSummaryBeatPips}>
                            {Array.from(
                                { length: Math.max(2, Math.min(5, boardFloaterMatchPayoffLadder.lanes.length + 1)) },
                                (_, index) => (
                                    <i
                                        data-match-payoff-ladder-summary-beat={index + 1}
                                        data-match-payoff-ladder-summary-beat-focus={
                                            index === 0 ? 'primary' : 'support'
                                        }
                                        key={`payoff-ladder-summary-beat-${index + 1}`}
                                    />
                                )
                            )}
                        </span>
                    </span>
                    <small>First</small>
                    <b data-match-payoff-ladder-step="first">{boardFloaterMatchPayoffLadder.first}</b>
                    <small>Then</small>
                    <b data-match-payoff-ladder-step="then">{boardFloaterMatchPayoffLadder.then}</b>
                    <small>Keep</small>
                    <b data-match-payoff-ladder-step="keep">{boardFloaterMatchPayoffLadder.keep}</b>
                    {boardFloaterMatchPayoffLadder.lanes.length > 0 ? (
                        <span className={styles.boardFloaterPayoffLaneStrip}>
                            {boardFloaterMatchPayoffLadder.lanes.map((lane, index) => (
                                <i data-match-payoff-lane-index={index + 1} key={`${lane}-${index}`}>
                                    <span aria-hidden="true" className={styles.boardFloaterPayoffLaneIndexPips}>
                                        {Array.from(
                                            { length: Math.min(3, index + 1) },
                                            (_, pipIndex) => (
                                                <em
                                                    data-match-payoff-lane-pip={pipIndex + 1}
                                                    data-match-payoff-lane-pip-focus={
                                                        pipIndex === 0 ? 'primary' : 'support'
                                                    }
                                                    key={`${lane}-${index}-pip-${pipIndex + 1}`}
                                                />
                                            )
                                        )}
                                    </span>
                                    {lane}
                                </i>
                            ))}
                        </span>
                    ) : null}
                    <span aria-hidden="true" className={styles.boardFloaterPayoffLadderBeatPips}>
                        {Array.from(
                            {
                                length: getBoardFloaterPayoffLadderBeatCount(
                                    boardFloaterMatchPayoffLadder
                                )
                            },
                            (_, index) => (
                                <i
                                    data-match-payoff-ladder-beat={index + 1}
                                    data-match-payoff-ladder-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`payoff-ladder-beat-${index + 1}`}
                                />
                            )
                        )}
                    </span>
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' ? (
                <span className={styles.boardFloaterScore}>
                    {boardFloaterPayload.routeRewardText ??
                        `+${runNonNegativeInteger(boardFloaterPayload.amount).toLocaleString()}`}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterPayload.chainDepth >= 3 ? (
                <span
                    className={styles.boardFloaterStreak}
                    data-chain-streak-depth={boardFloaterPayload.chainDepth}
                >
                    <span className={styles.boardFloaterStreakPips} aria-hidden="true">
                        {Array.from(
                            { length: Math.min(5, boardFloaterPayload.chainDepth) },
                            (_, index) => (
                                <i
                                    data-chain-streak-beat={index + 1}
                                    data-chain-streak-beat-focus={index === 0 ? 'primary' : 'support'}
                                    key={`board-streak-beat-${index + 1}`}
                                />
                        )
                    )}
                </span>
                    <span className={styles.boardFloaterStreakText}>x{boardFloaterPayload.chainDepth} streak</span>
                    {boardFloaterChainCue ? (
                        <span className={styles.boardFloaterStreakCue}>
                            <span aria-hidden="true" className={styles.boardFloaterStreakCuePips}>
                                {Array.from(
                                    { length: Math.min(5, Math.max(2, boardFloaterPayload.chainDepth)) },
                                    (_, index) => (
                                        <i
                                            data-chain-streak-cue-beat={index + 1}
                                            data-chain-streak-cue-beat-focus={
                                                index === 0 ? 'primary' : 'support'
                                            }
                                            key={`board-streak-cue-beat-${index + 1}`}
                                        />
                                    )
                                )}
                            </span>
                            {boardFloaterChainCue}
                        </span>
                    ) : null}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' &&
            boardFloaterMatchChainRewardForecastCues.length > 0 ? (
                <span
                    aria-label={`Match score floater reward forecast. ${boardFloaterMatchChainRewardForecastCues
                        .slice(0, 3)
                        .map((cue) => {
                            const stackLabel = getChainRewardStackLabel(cue);
                            const progress = getChainRewardProgress(boardFloaterPayload.chainDepth, cue);
                        
                            return `${cue.chaseLabel}: ${cue.actionLabel}: ${getChainRewardLaneAction(cue.urgency)}: ${cue.label}: ${cue.distanceLabel}: ${getChainRewardUrgencyCopy(cue)}${
                                progress ? `: ${progress.label}: ${progress.remainingLabel}` : ''
                            }${stackLabel ? `: ${stackLabel}` : ''}`;
                        })
                        .join('. ')}.`}
                    className={styles.boardFloaterRewardForecast}
                    data-testid="match-score-floater-reward-forecast"
                >
                    <span
                        className={styles.boardFloaterRewardForecastSummary}
                        data-chain-reward-forecast-count={boardFloaterMatchChainRewardForecastCues.slice(0, 3).length}
                        data-testid="match-score-floater-reward-forecast-summary"
                    >
                        <small>Forecast</small>
                        <b>
                            {boardFloaterMatchChainRewardForecastCues.slice(0, 3).length}{' '}
                            {boardFloaterMatchChainRewardForecastCues.slice(0, 3).length === 1 ? 'reward' : 'rewards'}
                        </b>
                        <span aria-hidden="true" className={styles.boardFloaterRewardForecastSummaryBeatPips}>
                            {Array.from(
                                { length: Math.max(2, Math.min(5, boardFloaterMatchChainRewardForecastCues.slice(0, 3).length + 1)) },
                                (_, index) => (
                                    <i
                                        data-chain-reward-forecast-summary-beat={index + 1}
                                        data-chain-reward-forecast-summary-beat-focus={
                                            index === 0 ? 'primary' : 'support'
                                        }
                                        key={`reward-forecast-summary-beat-${index + 1}`}
                                    />
                                )
                            )}
                        </span>
                    </span>
                    {boardFloaterMatchChainRewardForecastCues.slice(0, 3).map((cue) => {
                        const stackLabel = getChainRewardStackLabel(cue);
                        const progress = getChainRewardProgress(boardFloaterPayload.chainDepth, cue);
                        const beatCount = getBoardFloaterRewardForecastBeatCount(cue);
                        const progressFill = progress
                            ? `${Math.max(0, Math.min(100, (progress.filled / progress.total) * 100))}%`
                            : '0%';
                        
                        return (
                            <span
                                data-chain-reward-arcade-cue={getChainRewardUrgencyCopy(cue)}
                                data-chain-reward-audio={getBoardFloaterRewardForecastAudioCue(cue)}
                                data-chain-reward-beats={beatCount}
                                data-chain-reward-distance={cue.distance}
                                data-chain-reward-progress-filled={progress?.filled ?? 0}
                                data-chain-reward-progress-total={progress?.total ?? 0}
                                data-chain-reward-lane-action={getChainRewardLaneAction(cue.urgency)}
                                data-chain-reward-progress={progress?.label ?? 'none'}
                                data-chain-reward-screen-cue={getBoardFloaterRewardForecastScreenCue(cue)}
                                data-chain-reward-stack-size={cue.stackSize ?? 1}
                                data-chain-reward-tone={cue.tone}
                                data-chain-reward-urgency={cue.urgency}
                                style={
                                    progress
                                        ? ({
                                              '--chain-reward-progress-fill': progressFill
                                          } as CSSProperties)
                                        : undefined
                                }
                                key={cue.id}
                            >
                                <strong>{cue.chaseLabel}</strong>
                                <small>{cue.actionLabel}</small>
                                <u>{getChainRewardLaneAction(cue.urgency)}</u>
                                <b>{cue.label}</b>
                                <em>{cue.distanceLabel}</em>
                                <i>{getChainRewardUrgencyCopy(cue)}</i>
                                {progress ? (
                                    <span className={styles.boardFloaterRewardProgress}>
                                        {progress.label}
                                    </span>
                                ) : null}
                                {stackLabel ? (
                                    <>
                                        <mark className={styles.boardFloaterRewardStackLabel}>{stackLabel}</mark>
                                        <span aria-hidden="true" className={styles.boardFloaterRewardStackPips}>
                                            {Array.from({ length: cue.stackSize ?? 1 }, (_, index) => (
                                                <i
                                                    data-chain-reward-stack-beat={index + 1}
                                                    data-chain-reward-stack-beat-focus={
                                                        index === 0 ? 'primary' : 'support'
                                                    }
                                                    key={`${cue.id}-board-reward-stack-${index + 1}`}
                                                />
                                            ))}
                                        </span>
                                    </>
                                ) : null}
                                <span aria-hidden="true" className={styles.boardFloaterRewardBeatPips}>
                                    {Array.from({ length: beatCount }, (_, index) => (
                                        <i
                                            data-chain-reward-beat={index + 1}
                                            data-chain-reward-beat-focus={index === 0 ? 'primary' : 'support'}
                                            key={`${cue.id}-board-reward-beat-${index + 1}`}
                                        />
                                    ))}
                                </span>
                            </span>
                        );
                    })}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' &&
            boardFloaterMatchPayoffChips.length > 0 ? (
                <span
                    aria-label={`Match score payoff chips. ${boardFloaterMatchPayoffChips
                        .map((chip) => `${chip.arcadeCue ? `${chip.arcadeCue}: ` : ''}${chip.label}: ${chip.value}`)
                        .join('. ')}.`}
                    className={styles.boardFloaterPayoffChips}
                    data-testid="match-score-floater-payoff-chips"
                >
                    {boardFloaterMatchPayoffChips.map((chip) => (
                        <span
                            data-match-payoff-arcade-cue={chip.arcadeCue ?? 'none'}
                            data-match-payoff-arcade-screen-cue={getMatchPayoffChipScreenCue(chip)}
                            data-match-payoff-audio={getMatchPayoffChipAudioCue(chip)}
                            data-match-payoff-beats={getMatchPayoffChipBeatCount(chip)}
                            data-match-payoff-id={chip.id}
                            data-match-payoff-screen-cue={getMatchPayoffChipScreenCue(chip)}
                            data-match-payoff-tone={chip.tone}
                            key={chip.id}
                        >
                            {chip.arcadeCue ? <em>{chip.arcadeCue}</em> : null}
                            <small>{chip.label}</small>
                            <b>{chip.value}</b>
                            <span className={styles.boardFloaterChipBeats} aria-hidden="true">
                                {Array.from({ length: getMatchPayoffChipBeatCount(chip) }, (_, index) => (
                                    <i
                                        data-match-payoff-chip-beat={index + 1}
                                        data-match-payoff-chip-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={`match-payoff-chip-beat-${chip.id}-${index + 1}`}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
            ) : null}
            {boardFloaterPayload.kind === 'match' && boardFloaterTraitLaneMap.length > 1 ? (
                <span
                    aria-label={formatTraitInteractionLaneMapLabel(
                        'Match trait interaction lanes',
                        boardFloaterTraitLaneMap
                    )}
                    className={styles.boardFloaterTraitLaneMap}
                    data-match-trait-lane-actions={boardFloaterTraitLaneActionMapAttr}
                    data-match-trait-lane-map={boardFloaterTraitLaneMapAttr}
                    data-match-trait-primary-lane={boardFloaterPrimaryTraitLane?.id ?? 'none'}
                    data-match-trait-primary-lane-action={
                        boardFloaterPrimaryTraitLane
                            ? getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)
                            : 'none'
                    }
                    data-match-trait-primary-lane-audio={
                        boardFloaterPrimaryTraitLane
                            ? getBoardFloaterTraitLaneAudioCue(boardFloaterPrimaryTraitLane)
                            : 'none'
                    }
                    data-match-trait-primary-lane-beats={
                        boardFloaterPrimaryTraitLane
                            ? getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane)
                            : 0
                    }
                    data-match-trait-primary-lane-cue={boardFloaterPrimaryTraitLane?.cue ?? 'none'}
                    data-match-trait-primary-lane-screen-cue={
                        boardFloaterPrimaryTraitLane
                            ? getBoardFloaterTraitLaneScreenCue(boardFloaterPrimaryTraitLane)
                            : 'none'
                    }
                    data-testid="match-score-floater-trait-lane-map"
                >
                    <span
                        className={styles.boardFloaterTraitLaneMapSummary}
                        data-match-trait-lane-count={boardFloaterTraitLaneMap.length}
                        data-match-trait-lane-summary-fill={boardFloaterTraitLaneMapSummaryFill}
                        data-match-trait-lane-summary-total={Math.max(1, Math.min(5, boardFloaterTraitLaneMap.length))}
                        style={
                            {
                                '--trait-lane-summary-fill': `${boardFloaterTraitLaneMapSummaryFill}%`
                            } as CSSProperties
                        }
                        data-testid="match-score-floater-trait-lane-map-summary"
                    >
                        <small>Traits</small>
                        <b>
                            {boardFloaterTraitLaneMap.length}{' '}
                            {boardFloaterTraitLaneMap.length === 1 ? 'lane' : 'lanes'}
                        </b>
                        <span aria-hidden="true" className={styles.boardFloaterTraitLaneMapSummaryBeatPips}>
                            {Array.from(
                                { length: Math.max(2, Math.min(5, boardFloaterTraitLaneMap.length + 1)) },
                                (_, index) => (
                                    <i
                                        data-match-trait-lane-map-summary-beat={index + 1}
                                        data-match-trait-lane-map-summary-beat-focus={
                                            index === 0 ? 'primary' : 'support'
                                        }
                                        key={`trait-lane-map-summary-beat-${index + 1}`}
                                    />
                                )
                        )}
                        </span>
                        <span aria-hidden="true" className={styles.boardFloaterTraitLaneMapSummaryMeter} />
                    </span>
                    {boardFloaterPrimaryTraitLane ? (
                        <span
                            aria-label={`Primary trait payoff lane. ${boardFloaterPrimaryTraitLane.label}: ${getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)}. ${boardFloaterPrimaryTraitLane.cue}. ${getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane)} beats.`}
                            className={styles.boardFloaterPrimaryTraitLane}
                            data-match-trait-primary-lane={boardFloaterPrimaryTraitLane.id}
                            data-match-trait-primary-lane-action={getTraitInteractionLaneAction(
                                boardFloaterPrimaryTraitLane.id
                            )}
                            data-match-trait-primary-lane-audio={getBoardFloaterTraitLaneAudioCue(
                                boardFloaterPrimaryTraitLane
                            )}
                            data-match-trait-primary-lane-beats={getBoardFloaterTraitLaneBeatCount(
                                boardFloaterPrimaryTraitLane
                            )}
                            data-match-trait-primary-lane-cue={boardFloaterPrimaryTraitLane.cue}
                            data-match-trait-primary-lane-screen-cue={getBoardFloaterTraitLaneScreenCue(
                                boardFloaterPrimaryTraitLane
                            )}
                            data-match-trait-primary-lane-fill={boardFloaterPrimaryTraitLaneFill}
                            style={
                                {
                                    '--trait-lane-primary-fill': `${boardFloaterPrimaryTraitLaneFill}%`
                                } as CSSProperties
                            }
                            data-testid="match-score-floater-primary-trait-lane"
                        >
                            <small>Trait focus</small>
                            <b>{boardFloaterPrimaryTraitLane.label}</b>
                            <strong>{getTraitInteractionLaneAction(boardFloaterPrimaryTraitLane.id)}</strong>
                            <em>{boardFloaterPrimaryTraitLane.cue}</em>
                            <span aria-hidden="true" className={styles.boardFloaterPrimaryTraitLaneBeatPips}>
                                {Array.from(
                                    { length: getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane) },
                                    (_, beatIndex) => (
                                        <i
                                            data-match-trait-primary-lane-beat={beatIndex + 1}
                                            data-match-trait-primary-lane-beat-focus={
                                                beatIndex === 0 ? 'primary' : 'support'
                                            }
                                            key={beatIndex}
                                        />
                                    )
                                )}
                            </span>
                        </span>
                    ) : null}
                    {boardFloaterTraitLaneMap.map((lane) => (
                        <span
                            data-match-trait-lane={lane.id}
                            data-match-trait-lane-action={getTraitInteractionLaneAction(lane.id)}
                            data-match-trait-lane-audio={getBoardFloaterTraitLaneAudioCue(lane)}
                            data-match-trait-lane-beats={getBoardFloaterTraitLaneBeatCount(lane)}
                            data-match-trait-lane-count={lane.count}
                            data-match-trait-lane-screen-cue={getBoardFloaterTraitLaneScreenCue(lane)}
                            key={lane.id}
                        >
                            <small>{lane.label}</small>
                            {lane.count > 1 ? <b>x{lane.count}</b> : null}
                            <strong>{getTraitInteractionLaneAction(lane.id)}</strong>
                            <em>{lane.cue}</em>
                            <span aria-hidden="true" className={styles.boardFloaterTraitLaneBeatPips}>
                                {Array.from({ length: getBoardFloaterTraitLaneBeatCount(lane) }, (_, index) => (
                                    <i
                                        data-match-trait-lane-beat={index + 1}
                                        data-match-trait-lane-beat-focus={index === 0 ? 'primary' : 'support'}
                                        key={`${lane.id}-trait-lane-beat-${index + 1}`}
                                    />
                                ))}
                            </span>
                        </span>
                    ))}
                </span>
            ) : null}
            {boardFloaterDetailLines.slice(0, 2).map((line) => (
                <span className={styles.boardFloaterTraitLine} key={line}>
                    {line}
                </span>
            ))}
        </>
    );
};
