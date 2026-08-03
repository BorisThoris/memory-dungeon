import type { RunState } from '../../shared/contracts';
import { getChainTargetFeedback } from '../../shared/chain-targets';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import {
    getChainRewardForecastCues,
    getChainRewardUrgencyCopy
} from '../copy/chainMomentum';
import {
    getFindableToastText
} from '../hooks/useHudPoliteLiveAnnouncement';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { routeTypeLabel } from './gameScreenDecisionSignals';

type FloorClearCashoutTone = 'chain' | 'missed' | 'reward';
type FloorClearCashoutRow = {
    detail: string;
    id: 'cashout' | 'missed' | 'next';
    label: string;
    tone: FloorClearCashoutTone;
    value: string;
};

type FloorClearCarryForwardCue = {
    detail: string;
    label: 'Carry forward';
    tone: 'chain' | 'missed' | 'reward' | 'trait';
    value: string;
};

type FloorClearPayoffStackSignal = {
    detail: string;
    label: 'Floor payoff stack' | 'Super stack';
    tone: 'combo' | 'missed' | 'reward' | 'setup' | 'super';
    value: string;
};

type FloorClearActionSequenceCue = {
    first: string;
    keep: string;
    label: 'Next floor loop';
    then: string;
    tone: 'cashout' | 'recover' | 'reward' | 'route';
};

export type FloorClearObjectiveSignalRow = {
    id: string;
    label: string;
    tone: 'momentum' | 'neutral' | 'reward' | 'risk' | 'trait';
    value: string;
};

export const getFloorClearPayoffStackBeatCount = (signal: FloorClearPayoffStackSignal): 2 | 3 | 4 | 5 => {
    if (signal.tone === 'super') {
        return 5;
    }
    if (signal.tone === 'combo') {
        return 4;
    }
    if (signal.tone === 'missed') {
        return 3;
    }
    return 2;
};

export const getFloorClearPayoffStackAction = (
    signal: FloorClearPayoffStackSignal
): 'Bank stack' | 'Build bigger' | 'Recover value' | 'Rebuild stack' => {
    if (signal.tone === 'super') {
        return 'Rebuild stack';
    }
    if (signal.tone === 'combo' || signal.tone === 'reward') {
        return 'Bank stack';
    }
    if (signal.tone === 'missed') {
        return 'Recover value';
    }
    return 'Build bigger';
};

export const getFloorClearPayoffStackAudioCue = (
    signal: FloorClearPayoffStackSignal
): 'floor-stack-combo' | 'floor-stack-missed' | 'floor-stack-reward' | 'floor-stack-setup' | 'floor-stack-super' => {
    if (signal.tone === 'super') {
        return 'floor-stack-super';
    }
    if (signal.tone === 'combo') {
        return 'floor-stack-combo';
    }
    if (signal.tone === 'missed') {
        return 'floor-stack-missed';
    }
    if (signal.tone === 'reward') {
        return 'floor-stack-reward';
    }
    return 'floor-stack-setup';
};

export const getFloorClearPayoffStackScreenCue = (
    signal: FloorClearPayoffStackSignal
): 'burst' | 'pulse' | 'risk' | 'super' => {
    if (signal.tone === 'super') {
        return 'super';
    }
    if (signal.tone === 'combo' || signal.tone === 'reward') {
        return 'burst';
    }
    if (signal.tone === 'missed') {
        return 'risk';
    }
    return 'pulse';
};

export const getFloorClearObjectiveSignalBeatCount = (row: FloorClearObjectiveSignalRow): 1 | 2 | 3 | 4 => {
    if (row.tone === 'reward' || row.tone === 'trait') {
        return 4;
    }
    if (row.tone === 'risk' || row.tone === 'momentum') {
        return 3;
    }
    return 2;
};

export const getFloorClearObjectiveSignalAudioCue = (
    row: FloorClearObjectiveSignalRow
): 'floor-objective-momentum' | 'floor-objective-neutral' | 'floor-objective-reward' | 'floor-objective-risk' | 'floor-objective-trait' => {
    if (row.tone === 'reward') {
        return 'floor-objective-reward';
    }
    if (row.tone === 'trait') {
        return 'floor-objective-trait';
    }
    if (row.tone === 'risk') {
        return 'floor-objective-risk';
    }
    if (row.tone === 'momentum') {
        return 'floor-objective-momentum';
    }
    return 'floor-objective-neutral';
};

export const getFloorClearObjectiveSignalScreenCue = (
    row: FloorClearObjectiveSignalRow
): 'burst' | 'guard' | 'pulse' | 'tick' | 'trait' => {
    if (row.tone === 'reward') {
        return 'burst';
    }
    if (row.tone === 'trait') {
        return 'trait';
    }
    if (row.tone === 'risk') {
        return 'guard';
    }
    if (row.tone === 'momentum') {
        return 'pulse';
    }
    return 'tick';
};

export type NextFloorSignalRow = {
    detail: string | null;
    id: string;
    label: string;
    tone: 'counterplay' | 'neutral' | 'pressure' | 'reward' | 'route';
    value: string;
};

export const getNextFloorSignalBeatCount = (row: NextFloorSignalRow): 2 | 3 | 4 => {
    if (row.tone === 'reward' || row.tone === 'counterplay') {
        return 4;
    }
    if (row.tone === 'pressure') {
        return 3;
    }
    return 2;
};

export const getNextFloorSignalAudioCue = (
    row: NextFloorSignalRow
): 'next-floor-counterplay' | 'next-floor-neutral' | 'next-floor-pressure' | 'next-floor-reward' | 'next-floor-route' => {
    if (row.tone === 'counterplay') {
        return 'next-floor-counterplay';
    }
    if (row.tone === 'pressure') {
        return 'next-floor-pressure';
    }
    if (row.tone === 'reward') {
        return 'next-floor-reward';
    }
    if (row.tone === 'route') {
        return 'next-floor-route';
    }
    return 'next-floor-neutral';
};

export const getNextFloorSignalScreenCue = (
    row: NextFloorSignalRow
): 'burst' | 'guard' | 'pulse' | 'route' | 'tick' => {
    if (row.tone === 'reward' || row.tone === 'counterplay') {
        return 'burst';
    }
    if (row.tone === 'pressure') {
        return 'guard';
    }
    if (row.tone === 'route') {
        return 'route';
    }
    return row.tone === 'neutral' ? 'tick' : 'pulse';
};

const getFloorClearChainCashoutLabels = (run: RunState): string[] => {
    const bestStreak = runNonNegativeInteger(run.stats.bestStreak);
    if (bestStreak < 4) {
        return [];
    }

    for (let probeStreak = bestStreak - 1; probeStreak >= 0; probeStreak -= 1) {
        const hitCues = getChainRewardForecastCues(probeStreak, run.stats.comboShards, run.lives).filter(
            (cue) => cue.urgency === 'next' && cue.targetStreak <= bestStreak
        );
        if (hitCues.length > 0) {
            return hitCues.map((cue) => cue.label);
        }
    }

    return [];
};

export const getFloorClearCashoutRows = (run: RunState): FloorClearCashoutRow[] => {
    const result = run.lastLevelResult;
    if (!result) {
        return [];
    }
    const pickupTotal = runNonNegativeInteger(run.findablesTotalThisFloor);
    const pickupClaimed = runNonNegativeInteger(run.findablesClaimedThisFloor);
    const missedPickups = Math.max(0, pickupTotal - pickupClaimed);
    const bestStreak = runNonNegativeInteger(run.stats.bestStreak);
    const scoreGained = runNonNegativeInteger(result.scoreGained);
    const objectiveBonusScore = runNonNegativeInteger(result.objectiveBonusScore);
    const mistakes = runNonNegativeInteger(result.mistakes);
    const traitPaid = Boolean(result.traitRouteObjectiveCompleted);
    const objectivePaid = Boolean(result.featuredObjectiveCompleted);
    const chainTarget = getChainTargetFeedback(bestStreak);
    const chainCashoutLabels = getFloorClearChainCashoutLabels(run);
    const chainCashoutValue = chainCashoutLabels.length > 0 ? chainCashoutLabels.join(' + ') : null;
    const rewardStack = [
        traitPaid ? 'trait route' : null,
        objectivePaid ? 'objective' : null,
        pickupClaimed > 0 ? `${pickupClaimed} pickup${pickupClaimed === 1 ? '' : 's'}` : null,
        chainCashoutValue ? `chain ${chainCashoutValue}` : null
    ].filter((item): item is string => item != null);
    const cashoutValue =
        rewardStack.length > 0
            ? rewardStack.join(' + ')
            : bestStreak >= 3
              ? `x${bestStreak} chain`
              : `+${scoreGained.toLocaleString()} score`;
    const cashoutDetail = [
        traitPaid
            ? result.traitRouteObjectiveReward ?? 'Trait route cashout paid.'
            : objectivePaid
              ? `+${objectiveBonusScore.toLocaleString()} objective score`
              : null,
        chainCashoutValue ? `Chain cashout: ${chainCashoutValue}.` : null
    ]
        .filter(Boolean)
        .join(' ');
    const missedValue =
        missedPickups > 0
            ? `${missedPickups} pickup${missedPickups === 1 ? '' : 's'} left`
            : !traitPaid && result.traitRouteObjectiveRequired != null
              ? 'trait route missed'
              : result.perfect
                ? 'perfect clear'
                : `${mistakes} miss${mistakes === 1 ? '' : 'es'}`;
    const nextValue =
        missedPickups > 0
            ? 'claim pickups'
            : chainTarget.value;

    return [
        {
            detail: cashoutDetail || 'Main score banked.',
            id: 'cashout',
            label: 'Cashout',
            tone: 'reward',
            value: cashoutValue
        },
        {
            detail: missedPickups > 0
                ? 'Visible reward pairs were left on the board.'
                : result.perfect
                  ? 'No miss tax; tempo stayed clean.'
                  : 'Misses broke chain pressure.',
            id: 'missed',
            label: missedPickups > 0 || !result.perfect ? 'Missed value' : 'Clean read',
            tone: missedPickups > 0 || !result.perfect ? 'missed' : 'reward',
            value: missedValue
        },
        {
            detail: missedPickups > 0
                ? 'Prioritize marked reward pairs before ending the floor.'
                : chainTarget.actionHint,
            id: 'next',
            label: 'Next chase',
            tone: missedPickups === 0 ? 'chain' : 'reward',
            value: nextValue
        }
    ];
};

export const getFloorClearPayoffStackSignal = (
    run: RunState,
    floorClearCashoutRows: readonly FloorClearCashoutRow[],
    floorClearObjectiveSignalRows: readonly { id: string; label: string; value: string; tone: string }[],
    favorBankedPickCount: number
): FloorClearPayoffStackSignal | null => {
    const result = run.lastLevelResult;
    if (!result) {
        return null;
    }

    const bestStreak = runNonNegativeInteger(run.stats.bestStreak);
    const lanes = [
        result.traitRouteObjectiveCompleted ? 'Trait route' : null,
        result.featuredObjectiveCompleted ? 'Objective' : null,
        runNonNegativeInteger(run.findablesClaimedThisFloor) > 0 ? 'Pickup' : null,
        getFloorClearChainCashoutLabels(run).length > 0 ? 'Chain cashout' : bestStreak >= 3 ? 'Chain' : null,
        runNonNegativeInteger(run.stats.comboShards) > 0 ? 'Shard' : null,
        favorBankedPickCount > 0 ? 'Relic pick' : null
    ].filter((lane): lane is string => lane != null);
    const missedRows = floorClearCashoutRows.filter((row) => row.tone === 'missed');
    const objectivePaidRows = floorClearObjectiveSignalRows.filter(
        (row) => row.tone === 'reward' || row.tone === 'trait' || row.tone === 'momentum'
    );

    if (lanes.length >= 4) {
        return {
            detail: `${lanes.join(' + ')} paid on the clear; open the next floor by rebuilding the super-stack route.`,
            label: 'Super stack',
            tone: 'super',
            value: `${lanes.length} payoffs paid`
        };
    }

    if (lanes.length >= 2) {
        return {
            detail: `${lanes.join(' + ')} paid on the clear; route choice should build the next linked payoff.`,
            label: 'Floor payoff stack',
            tone: lanes.length >= 3 || objectivePaidRows.length >= 2 ? 'combo' : 'reward',
            value: `${lanes.length} payoffs paid`
        };
    }

    if (missedRows.length > 0) {
        return {
            detail: 'The clear landed, but the next floor should recover the missed value before ending.',
            label: 'Floor payoff stack',
            tone: 'missed',
            value: 'Value left open'
        };
    }

    return {
        detail: 'Score is banked; use the route choice to prime a bigger reward stack.',
        label: 'Floor payoff stack',
        tone: 'setup',
        value: 'Prime clear'
    };
};

export const getPickupStackToastText = (
    turnEvent: BoardTurnResolvedEvent
): string | null => {
    const claimedKind = turnEvent.matchedFindableKind;
    if (claimedKind == null) {
        return null;
    }
    const baseText = getFindableToastText(claimedKind);
    const nextReward = getChainRewardForecastCues(
        turnEvent.currentStreakAfter,
        turnEvent.comboShardsAfter,
        turnEvent.livesAfter
    )[0];
    const pickupClaimed = turnEvent.findablesClaimedAfter;
    const pickupTotal = turnEvent.findablesTotalAfter;
    const pickupProgress =
        pickupTotal > 0
            ? `Pickups ${pickupClaimed}/${pickupTotal}.`
            : null;

    if (nextReward?.urgency === 'next') {
        return [
            `Stack prime: ${baseText}.`,
            `${getChainRewardUrgencyCopy(nextReward)}: ${nextReward.label} in ${nextReward.distanceLabel}.`,
            pickupProgress
        ]
            .filter(Boolean)
            .join(' ');
    }

    return pickupProgress ? `${baseText}. ${pickupProgress}` : baseText;
};

export const getFloorClearCarryForwardCue = (run: RunState, favorBankedPickCount: number): FloorClearCarryForwardCue | null => {
    const result = run.lastLevelResult;
    if (!result) {
        return null;
    }
    const pickupTotal = runNonNegativeInteger(run.findablesTotalThisFloor);
    const pickupClaimed = runNonNegativeInteger(run.findablesClaimedThisFloor);
    const missedPickups = Math.max(0, pickupTotal - pickupClaimed);
    const bestStreak = runNonNegativeInteger(run.stats.bestStreak);
    const chainCashoutLabels = getFloorClearChainCashoutLabels(run);

    if (favorBankedPickCount > 0) {
        return {
            detail: 'Spend it at the next milestone draft.',
            label: 'Carry forward',
            tone: 'reward',
            value: `+${favorBankedPickCount} relic pick banked`
        };
    }
    if (result.traitRouteObjectiveCompleted) {
        return {
            detail: 'Open next floor by connecting trait cards.',
            label: 'Carry forward',
            tone: 'trait',
            value: 'Trait route engine live'
        };
    }
    if (bestStreak >= 6) {
        return {
            detail: chainCashoutLabels.length > 0
                ? `${chainCashoutLabels.join(' + ')} paid; chase reward-hot routes early.`
                : 'Chase reward-hot routes early.',
            label: 'Carry forward',
            tone: 'chain',
            value: chainCashoutLabels.length > 0 ? 'Chain cashout banked' : `x${bestStreak} chain ceiling`
        };
    }
    if (missedPickups > 0) {
        return {
            detail: 'Claim marked pairs before exit.',
            label: 'Carry forward',
            tone: 'missed',
            value: 'Pickup priority'
        };
    }
    return {
        detail: result.perfect ? 'Start the next floor with a confirmed-pair chain.' : 'Use safe matches to rebuild tempo.',
        label: 'Carry forward',
        tone: result.perfect ? 'reward' : 'chain',
        value: result.perfect ? 'Clean tempo' : 'Rebuild chain'
    };
};

export const getFloorClearActionSequenceCue = ({
    carryForwardCue,
    cashoutRows,
    payoffStackSignal,
    routeChoiceRequired,
    run
}: {
    carryForwardCue: FloorClearCarryForwardCue | null;
    cashoutRows: readonly FloorClearCashoutRow[];
    payoffStackSignal: FloorClearPayoffStackSignal | null;
    routeChoiceRequired: boolean;
    run: RunState;
}): FloorClearActionSequenceCue | null => {
    if (!run.lastLevelResult) {
        return null;
    }

    const chainTarget = getChainTargetFeedback(runNonNegativeInteger(run.stats.bestStreak));
    const missedRow = cashoutRows.find((row) => row.tone === 'missed');
    const nextRow = cashoutRows.find((row) => row.id === 'next');
    const first = routeChoiceRequired
        ? 'Choose route card'
        : run.pendingRouteCardPlan
          ? `Enter ${routeTypeLabel(run.pendingRouteCardPlan.routeType)} floor`
          : 'Continue descent';
    const then =
        carryForwardCue?.tone === 'reward'
            ? 'Spend banked relic pick'
            : missedRow
              ? `Recover ${missedRow.value}`
              : carryForwardCue?.tone === 'trait'
                ? 'Connect trait cards'
                : payoffStackSignal?.tone === 'combo' || payoffStackSignal?.tone === 'super'
                  ? 'Rebuild reward stack'
                  : 'Open with safe match';
    const keep =
        missedRow && carryForwardCue?.tone === 'reward'
            ? 'Claim pickups early'
            : nextRow?.tone === 'chain'
              ? nextRow.value
              : chainTarget.value;
    const tone =
        missedRow && carryForwardCue?.tone !== 'reward'
            ? 'recover'
            : routeChoiceRequired
              ? 'route'
              : payoffStackSignal?.tone === 'combo' || payoffStackSignal?.tone === 'super'
                ? 'cashout'
                : 'reward';

    return {
        first,
        keep,
        label: 'Next floor loop',
        then,
        tone
    };
};
