import { useMemo } from 'react';
import {
    getChainRewardLaneAction,
    getChainRewardUrgencyCopy
} from '../copy/chainMomentum';
import { matchScoreFloaterChainCue, matchScoreFloaterLiveRegionText } from '../copy/matchScoreFloater';
import {
    mismatchFloaterLiveRegionText,
    mismatchFloaterNextAction,
    mismatchFloaterRecoveryBurst,
    mismatchFloaterRecoveryChips,
    mismatchFloaterRecoveryCrescendo,
    mismatchFloaterRecoveryCrescendoLabel,
    mismatchFloaterRecoveryHint,
    mismatchFloaterRecoveryLaneMap,
    mismatchFloaterRecoverySequence,
    mismatchFloaterRecoveryStack,
    mismatchFloaterSignal
} from '../copy/mismatchFloater';
import {
    buildTraitInteractionLaneMap,
    formatTraitInteractionLaneMapLabel,
    traitInteractionLaneActionMapAttr,
    traitInteractionLaneMapAttr
} from '../copy/traitInteractionLaneMap';
import type { MatchScorePop, MismatchScorePop } from '../store/matchScorePop';
import {
    getBoardMatchPayoffStackBeatCount,
    getMismatchRecoveryLaneBeatCount,
    getPrimaryMismatchRecoveryLane,
    matchChainRewardForecastCues,
    matchPayoffChips,
    matchPayoffLadderLanes,
    matchPayoffLaneMap,
    matchPayoffLaneMapLabel,
    matchTraitInteractionTexts,
    mismatchRecoveryLaneMapLabel
} from './gameScreenBoardFeedbackModel';
import {
    actualMatchPayoffLaneCount,
    getBoardFloaterChainMilestoneBeatCount,
    getBoardFloaterRewardBurstBeatCount,
    getBoardFloaterTraitLaneBeatCount,
    getMatchFloaterJackpotCue
} from './gameScreenBoardFloaterModel';
import { matchScoreFloatDurationMs } from './matchScoreFloaterTiming';

export const useGameScreenBoardFloaterProjection = ({
    matchScorePop,
    mismatchScorePop,
    reduceMotion
}: {
    matchScorePop: MatchScorePop | null;
    mismatchScorePop: MismatchScorePop | null;
    reduceMotion: boolean;
}) => {
    const boardFloaterPayload = useMemo(
        () =>
            matchScorePop
                ? ({ kind: 'match' as const, ...matchScorePop })
                : mismatchScorePop
                  ? ({ kind: 'miss' as const, ...mismatchScorePop })
                  : null,
        [matchScorePop, mismatchScorePop]
    );
    const boardFloaterDurationMs = matchScoreFloatDurationMs(reduceMotion, boardFloaterPayload);
    const boardFloaterMatchPayoffChips = useMemo(
        () => (boardFloaterPayload?.kind === 'match' ? matchPayoffChips(boardFloaterPayload.payoffChips) : []),
        [boardFloaterPayload]
    );
    const boardFloaterMatchPayoffLaneMap = useMemo(
        () => (boardFloaterPayload?.kind === 'match' ? matchPayoffLaneMap(boardFloaterPayload.payoffLaneMap) : []),
        [boardFloaterPayload]
    );
    const boardFloaterMatchChainRewardForecastCues = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? matchChainRewardForecastCues(boardFloaterPayload.chainRewardForecastCues)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterMatchPayoffLadder = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match' && boardFloaterPayload.payoffLadder
                ? {
                      ...boardFloaterPayload.payoffLadder,
                      lanes: matchPayoffLadderLanes(boardFloaterPayload.payoffLadder.lanes)
                  }
                : null,
        [boardFloaterPayload]
    );
    const boardFloaterMatchTraitInteractionTexts = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? matchTraitInteractionTexts(boardFloaterPayload.traitInteractionTexts)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterMismatchTraitInteractionTexts = useMemo(
        () =>
            boardFloaterPayload?.kind === 'miss'
                ? matchTraitInteractionTexts(boardFloaterPayload.traitInteractionTexts)
                : [],
        [boardFloaterPayload]
    );
    const boardFloaterDetailLines = useMemo(() => {
        if (!boardFloaterPayload) {
            return [];
        }
        if (boardFloaterPayload.kind === 'match') {
            return [
                boardFloaterPayload.pickupRewardText,
                boardFloaterPayload.chainRewardText,
                ...boardFloaterMatchTraitInteractionTexts
            ].filter((line): line is string => Boolean(line));
        }
        return boardFloaterMismatchTraitInteractionTexts;
    }, [boardFloaterMatchTraitInteractionTexts, boardFloaterMismatchTraitInteractionTexts, boardFloaterPayload]);
    const boardFloaterTraitLaneMap = useMemo(
        () =>
            boardFloaterPayload?.kind === 'match'
                ? buildTraitInteractionLaneMap(boardFloaterMatchTraitInteractionTexts)
                : [],
        [boardFloaterMatchTraitInteractionTexts, boardFloaterPayload]
    );
    const boardFloaterTraitLaneMapAttr = traitInteractionLaneMapAttr(boardFloaterTraitLaneMap);
    const boardFloaterTraitLaneActionMapAttr = traitInteractionLaneActionMapAttr(boardFloaterTraitLaneMap);
    const boardFloaterPrimaryTraitLane = boardFloaterTraitLaneMap[0] ?? null;
    const boardFloaterTraitLaneMapSummaryFill = Math.min(100, (boardFloaterTraitLaneMap.length / 5) * 100);
    const boardFloaterPrimaryTraitLaneFill = boardFloaterPrimaryTraitLane
        ? Math.min(100, (getBoardFloaterTraitLaneBeatCount(boardFloaterPrimaryTraitLane) / 4) * 100)
        : 0;
    const boardFloaterChainCue =
        boardFloaterPayload?.kind === 'match' ? matchScoreFloaterChainCue(boardFloaterPayload.chainDepth) : '';
    const boardFloaterMismatchSignal =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterSignal(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecovery =
        boardFloaterPayload?.kind === 'miss' ? mismatchFloaterRecoveryHint(boardFloaterDetailLines) : null;
    const boardFloaterMismatchRecoveryCrescendo =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryCrescendo(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryCrescendoLabel = boardFloaterMismatchRecoveryCrescendo
        ? mismatchFloaterRecoveryCrescendoLabel('Mismatch recovery crescendo', boardFloaterMismatchRecoveryCrescendo)
        : '';
    const boardFloaterLiveText = useMemo(() => {
        if (!boardFloaterPayload) {
            return '';
        }
        if (boardFloaterPayload.kind === 'match') {
            return matchScoreFloaterLiveRegionText(
                boardFloaterPayload.amount,
                boardFloaterDetailLines,
                boardFloaterPayload.feedbackHeadline,
                boardFloaterPayload.chainDepth,
                boardFloaterMatchChainRewardForecastCues.map(
                    (cue) =>
                        `${getChainRewardLaneAction(cue.urgency)}: ${getChainRewardUrgencyCopy(cue)}: ${cue.distanceLabel} to ${cue.label}`
                ),
                boardFloaterPayload.rewardBurst
                    ? `${boardFloaterPayload.rewardBurst.label}: ${boardFloaterPayload.rewardBurst.action}: ${boardFloaterPayload.rewardBurst.value}`
                    : undefined,
                boardFloaterPayload.cascadeCue
                    ? `${boardFloaterPayload.cascadeCue.label}: ${boardFloaterPayload.cascadeCue.value}`
                    : undefined,
                boardFloaterPayload.payoffSummary
                    ? `${boardFloaterPayload.payoffSummary.label}: ${boardFloaterPayload.payoffSummary.value}`
                    : undefined,
                boardFloaterMatchPayoffLadder
                    ? `${boardFloaterPayload.impactCue.label}. First: ${boardFloaterMatchPayoffLadder.first}. Then: ${boardFloaterMatchPayoffLadder.then}. Keep: ${boardFloaterMatchPayoffLadder.keep}${
                          boardFloaterMatchPayoffLadder.lanes.length > 0
                              ? `. Lanes: ${boardFloaterMatchPayoffLadder.lanes.join(' to ')}`
                              : ''
                      }`
                    : boardFloaterPayload.impactCue.label,
                matchPayoffLaneMapLabel(boardFloaterMatchPayoffLaneMap),
                boardFloaterTraitLaneMap.length > 0
                    ? formatTraitInteractionLaneMapLabel('Match trait interaction lanes', boardFloaterTraitLaneMap)
                    : undefined,
                boardFloaterPayload.crescendo
                    ? `${boardFloaterPayload.crescendo.label}: ${boardFloaterPayload.crescendo.detail}`
                    : undefined,
                boardFloaterPayload.chainMilestone
                    ? `${boardFloaterPayload.chainMilestone.action}: ${boardFloaterPayload.chainMilestone.label}: ${boardFloaterPayload.chainMilestone.target}: ${boardFloaterPayload.chainMilestone.value}. ${boardFloaterPayload.chainMilestone.beatCount} beats.`
                    : undefined
            );
        }
        const mismatchContext = {
            brokenChainDepth: boardFloaterPayload.brokenChainDepth,
            brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
        };
        return mismatchFloaterLiveRegionText(
            boardFloaterDetailLines,
            boardFloaterMismatchRecovery,
            mismatchContext,
            mismatchRecoveryLaneMapLabel(
                mismatchFloaterRecoveryLaneMap(mismatchFloaterRecoveryChips(boardFloaterDetailLines, mismatchContext))
            ),
            boardFloaterMismatchRecoveryCrescendo
                ? `${boardFloaterMismatchRecoveryCrescendo.label}: ${boardFloaterMismatchRecoveryCrescendo.detail}`
                : undefined
        );
    }, [
        boardFloaterDetailLines,
        boardFloaterMatchChainRewardForecastCues,
        boardFloaterMatchPayoffLadder,
        boardFloaterMatchPayoffLaneMap,
        boardFloaterMismatchRecovery,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterPayload,
        boardFloaterTraitLaneMap
    ]);
    const boardFloaterMismatchRecoveryBurst =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryBurst(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryBurstFill = boardFloaterMismatchRecoveryCrescendo
        ? Math.min(100, (boardFloaterMismatchRecoveryCrescendo.beatCount / 5) * 100)
        : boardFloaterMismatchRecoveryBurst?.tier === 'break'
          ? 100
          : boardFloaterMismatchRecoveryBurst?.tier === 'risk'
            ? 75
            : boardFloaterMismatchRecoveryBurst?.tier === 'lost-reward'
              ? 90
              : 0;
    const boardFloaterMismatchNextAction =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterNextAction(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoveryChips =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryChips(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : [];
    const boardFloaterMismatchRecoveryLaneMap =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryLaneMap(boardFloaterMismatchRecoveryChips)
            : null;
    const boardFloaterPrimaryMismatchRecoveryLane = getPrimaryMismatchRecoveryLane(boardFloaterMismatchRecoveryLaneMap);
    const boardFloaterMismatchRecoveryLaneMapFill = Math.min(
        100,
        ((boardFloaterMismatchRecoveryLaneMap?.length ?? 0) / 4) * 100
    );
    const boardFloaterPrimaryMismatchRecoveryLaneFill = boardFloaterPrimaryMismatchRecoveryLane
        ? Math.min(100, (getMismatchRecoveryLaneBeatCount(boardFloaterPrimaryMismatchRecoveryLane) / 4) * 100)
        : 0;
    const boardFloaterMismatchRecoveryStack =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoveryStack(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardFloaterMismatchRecoverySequence =
        boardFloaterPayload?.kind === 'miss'
            ? mismatchFloaterRecoverySequence(boardFloaterDetailLines, {
                  brokenChainDepth: boardFloaterPayload.brokenChainDepth,
                  brokenChainRewardCue: boardFloaterPayload.brokenChainRewardCue
              })
            : null;
    const boardRecoveryContext =
        boardFloaterPayload?.kind === 'miss' && boardFloaterMismatchNextAction
            ? {
                  action:
                      boardFloaterMismatchNextAction.tone === 'lost-reward'
                          ? 'Save'
                          : boardFloaterMismatchNextAction.tone === 'risk'
                            ? 'Stabilize'
                            : 'Recover',
                  detail:
                      boardFloaterMismatchRecoveryStack?.detail ??
                      boardFloaterMismatchRecovery ??
                      boardFloaterMismatchNextAction.value,
                  impactCue: boardFloaterMismatchNextAction.arcadeCue,
                  tone: boardFloaterMismatchNextAction.tone,
                  value: boardFloaterMismatchNextAction.value
              }
            : null;
    const boardMatchPayoffStackCue =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.payoffSummary
            ? {
                  label: boardFloaterPayload.payoffSummary.label,
                  value: boardFloaterPayload.payoffSummary.value,
                  tone: boardFloaterPayload.payoffSummary.tier,
                  laneCount: actualMatchPayoffLaneCount(
                      boardFloaterPayload.payoffSummary,
                      boardFloaterMatchPayoffChips
                  ),
                  firstCue: boardFloaterMatchPayoffChips[0]?.arcadeCue ?? boardFloaterPayload.impactCue.label,
                  sequenceFirstCue:
                      boardFloaterMatchPayoffChips.find((chip) => chip.id !== 'score')?.arcadeCue ??
                      boardFloaterPayload.impactCue.label,
                  nextCue:
                      boardFloaterMatchPayoffChips.find((chip) => chip.id === 'next')?.arcadeCue ??
                      boardFloaterPayload.rewardBurst?.value ??
                      null,
                  sequenceKeepCue:
                      boardFloaterMatchChainRewardForecastCues[0]?.chaseLabel ??
                      boardFloaterMatchPayoffChips.find((chip) => chip.id === 'next')?.value ??
                      'Chase next safe match'
              }
            : null;
    const boardMatchPayoffStackFill = boardMatchPayoffStackCue
        ? Math.round(Math.min(100, (getBoardMatchPayoffStackBeatCount(boardMatchPayoffStackCue) / 5) * 100))
        : 0;
    const boardFloaterJackpotCue =
        boardFloaterPayload?.kind === 'match' ? getMatchFloaterJackpotCue(boardFloaterPayload) : null;
    const boardFloaterPrimaryPayoffLane =
        boardFloaterPayload?.kind === 'match' ? boardFloaterMatchPayoffLaneMap[0] ?? null : null;
    const boardFloaterChainMilestoneFill =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.chainMilestone
            ? Math.round(
                  Math.min(
                      100,
                      (getBoardFloaterChainMilestoneBeatCount(boardFloaterPayload.chainMilestone) / 5) * 100
                  )
              )
            : 0;
    const boardFloaterRewardBurstFill =
        boardFloaterPayload?.kind === 'match' && boardFloaterPayload.rewardBurst
            ? Math.round(Math.min(100, (getBoardFloaterRewardBurstBeatCount(boardFloaterPayload.rewardBurst) / 5) * 100))
            : 0;

    return {
        boardFloaterPayload,
        boardFloaterDurationMs,
        boardFloaterMatchPayoffChips,
        boardFloaterMatchPayoffLaneMap,
        boardFloaterMatchChainRewardForecastCues,
        boardFloaterMatchPayoffLadder,
        boardFloaterMatchTraitInteractionTexts,
        boardFloaterMismatchTraitInteractionTexts,
        boardFloaterDetailLines,
        boardFloaterTraitLaneMap,
        boardFloaterTraitLaneMapAttr,
        boardFloaterTraitLaneActionMapAttr,
        boardFloaterPrimaryTraitLane,
        boardFloaterTraitLaneMapSummaryFill,
        boardFloaterPrimaryTraitLaneFill,
        boardFloaterChainCue,
        boardFloaterMismatchSignal,
        boardFloaterMismatchRecovery,
        boardFloaterMismatchRecoveryCrescendo,
        boardFloaterMismatchRecoveryCrescendoLabel,
        boardFloaterLiveText,
        boardFloaterMismatchRecoveryBurst,
        boardFloaterMismatchRecoveryBurstFill,
        boardFloaterMismatchNextAction,
        boardFloaterMismatchRecoveryChips,
        boardFloaterMismatchRecoveryLaneMap,
        boardFloaterPrimaryMismatchRecoveryLane,
        boardFloaterMismatchRecoveryLaneMapFill,
        boardFloaterPrimaryMismatchRecoveryLaneFill,
        boardFloaterMismatchRecoveryStack,
        boardFloaterMismatchRecoverySequence,
        boardRecoveryContext,
        boardMatchPayoffStackCue,
        boardMatchPayoffStackFill,
        boardFloaterJackpotCue,
        boardFloaterPrimaryPayoffLane,
        boardFloaterChainMilestoneFill,
        boardFloaterRewardBurstFill
    };
};
