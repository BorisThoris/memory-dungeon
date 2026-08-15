import type { MismatchFloaterRecoveryChip } from '../copy/mismatchFloater';
import type { TraitInteractionLaneMapEntry } from '../copy/traitInteractionLaneMap';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import type {
    MatchScorePop,
    MatchScorePopPayoffLaneMapEntry,
    MismatchScorePop
} from '../store/matchScorePop';
import {
    matchPayoffChips,
    matchPayoffLadderLanes,
    matchPayoffLaneAction,
    matchPayoffLaneMap,
    matchTraitInteractionTexts
} from './gameScreenBoardFeedbackModel';

export const actualMatchPayoffLaneCount = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>,
    payoffChips: readonly NonNullable<MatchScorePop['payoffChips']>[number][] = []
): number => {
    const summaryLaneCount = /^(\d+)\s+(?:payoffs|lanes)\b/.exec(payoffSummary.value)?.[1];
    if (summaryLaneCount) {
        return Number(summaryLaneCount);
    }
    const cashoutChipCount = payoffChips.filter((chip) =>
        chip.id === 'route' || chip.id === 'pickup' || chip.id === 'trait' || chip.id === 'chainReward'
    ).length;
    return Math.max(cashoutChipCount, payoffSummary.tier === 'score' ? 0 : 1);
};

type MatchFloaterHeat = 'cashout' | 'prime' | 'score' | 'stack' | 'surge';
type MismatchFloaterHeat = 'break' | 'lost-reward' | 'recover' | 'risk' | 'trait-surge';
type MatchPayoffChip = NonNullable<MatchScorePop['payoffChips']>[number];
type MatchFloaterJackpotCue = {
    action: string;
    beatCount: 3 | 4 | 5;
    label: string;
    tier: 'cashout' | 'stack' | 'super';
    value: string;
};

export const getMatchFloaterHeat = (payload: MatchScorePop): MatchFloaterHeat => {
    const impactLabel = payload.impactCue.label.toLowerCase();
    const payoffSummaryLabel = payload.payoffSummary?.label.toLowerCase() ?? '';
    const payoffChipCues = matchPayoffChips(payload.payoffChips).map((chip) => chip.arcadeCue?.toLowerCase() ?? '');

    if (payoffSummaryLabel === 'super stack' || impactLabel === 'super stack') {
        return 'stack';
    }
    if (payoffSummaryLabel === 'stack cashout' || impactLabel === 'stack cashout') {
        return 'stack';
    }
    if (
        payload.impactCue.tone === 'combo' ||
        impactLabel.includes('surge') ||
        payoffChipCues.some((cue) => cue.includes('surge'))
    ) {
        return 'surge';
    }
    if (impactLabel.includes('cashout') || payoffSummaryLabel.includes('cashout')) {
        return 'cashout';
    }
    if (impactLabel.includes('prime') || payoffChipCues.some((cue) => cue.includes('prime'))) {
        return 'prime';
    }
    if (payoffChipCues.some((cue) => cue.includes('cashout'))) {
        return 'cashout';
    }
    return 'score';
};

export const getBoardFloaterImpactCueBeatCount = (payload: MatchScorePop): 2 | 3 | 4 | 5 => {
    const cueLabel = payload.impactCue.label.toLowerCase();
    const baseBeatCount =
        cueLabel === 'super stack'
            ? 5
            : cueLabel === 'stack cashout' || cueLabel.includes('cashout')
              ? 4
              : payload.impactCue.tone === 'reward' ||
                  payload.impactCue.tone === 'pickup' ||
                  payload.impactCue.tone === 'route' ||
                  payload.impactCue.tone === 'trait'
                ? 4
                : payload.impactCue.tone === 'combo' || payload.impactCue.tone === 'chain'
                  ? 3
                  : 2;
    return Math.max(baseBeatCount, payload.crescendo?.beatCount ?? 0) as 2 | 3 | 4 | 5;
};

export const getBoardFloaterImpactCueScreenCue = (payload: MatchScorePop): 'burst' | 'pulse' | 'route' | 'surge' => {
    const cueLabel = payload.impactCue.label.toLowerCase();
    if (cueLabel === 'super stack' || cueLabel.includes('stack') || cueLabel.includes('cashout')) {
        return 'burst';
    }
    if (payload.impactCue.tone === 'trait' || payload.impactCue.tone === 'combo' || cueLabel.includes('surge')) {
        return 'surge';
    }
    if (payload.impactCue.tone === 'route') {
        return 'route';
    }
    return 'pulse';
};

export const getBoardFloaterRewardBurstBeatCount = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 3 | 4 | 5 => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 5;
    }
    if (rewardBurst.tier === 'stack') {
        return 4;
    }
    return 3;
};

export const getBoardFloaterRewardBurstAudioCue = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 'reward-burst-hit' | 'reward-burst-stack' | 'reward-burst-super' => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 'reward-burst-super';
    }
    if (rewardBurst.tier === 'stack') {
        return 'reward-burst-stack';
    }
    return 'reward-burst-hit';
};

export const getBoardFloaterRewardBurstScreenCue = (
    rewardBurst: NonNullable<MatchScorePop['rewardBurst']>
): 'pulse' | 'burst' | 'super' => {
    if (rewardBurst.tier === 'mega' || rewardBurst.label === 'Super stack') {
        return 'super';
    }
    if (rewardBurst.tier === 'stack') {
        return 'burst';
    }
    return 'pulse';
};

export const getBoardFloaterCascadeBeatCount = (
    cascadeCue: NonNullable<MatchScorePop['cascadeCue']>
): 3 | 4 | 5 => {
    if (cascadeCue.tier === 'combo') {
        return 5;
    }
    if (cascadeCue.tier === 'reward') {
        return 4;
    }
    return 3;
};

export const getBoardFloaterPayoffSummaryBeatCount = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 2 | 3 | 4 | 5 => {
    if (payoffSummary.label === 'Super stack') {
        return 5;
    }
    if (payoffSummary.label === 'Stack cashout' || payoffSummary.tier === 'reward') {
        return 4;
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 3;
    }
    return 2;
};

export const getBoardFloaterPayoffSummaryAudioCue = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 'payoff-summary-score' | 'payoff-summary-chain' | 'payoff-summary-cashout' | 'payoff-summary-stack' | 'payoff-summary-super' => {
    if (payoffSummary.label === 'Super stack') {
        return 'payoff-summary-super';
    }
    if (payoffSummary.label === 'Stack cashout') {
        return 'payoff-summary-stack';
    }
    if (payoffSummary.tier === 'reward' || payoffSummary.label.includes('cashout')) {
        return 'payoff-summary-cashout';
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 'payoff-summary-chain';
    }
    return 'payoff-summary-score';
};

export const getBoardFloaterPayoffSummaryScreenCue = (
    payoffSummary: NonNullable<MatchScorePop['payoffSummary']>
): 'tick' | 'pulse' | 'burst' | 'super' => {
    if (payoffSummary.label === 'Super stack') {
        return 'super';
    }
    if (payoffSummary.label === 'Stack cashout' || payoffSummary.tier === 'reward') {
        return 'burst';
    }
    if (payoffSummary.tier === 'combo' || payoffSummary.tier === 'chain') {
        return 'pulse';
    }
    return 'tick';
};

export const getMatchFloaterJackpotCue = (payload: MatchScorePop): MatchFloaterJackpotCue | null => {
    const summary = payload.payoffSummary;
    const rewardBurst = payload.rewardBurst;
    const payoffChips = matchPayoffChips(payload.payoffChips);
    const laneCount = Math.max(matchPayoffLaneMap(payload.payoffLaneMap).length, summary ? actualMatchPayoffLaneCount(summary, payoffChips) : 0);
    const impactLabel = payload.impactCue.label;
    const impactLabelLower = impactLabel.toLowerCase();
    const crescendo = payload.crescendo;

    if (summary?.label === 'Super stack' || rewardBurst?.label === 'Super stack' || crescendo?.tier === 'super') {
        return {
            action: rewardBurst?.action ?? 'Cash super stack',
            beatCount: 5,
            label: 'Super stack',
            tier: 'super',
            value: summary?.value ?? rewardBurst?.value ?? `${Math.max(laneCount, 4)} payoff lanes`
        };
    }
    if (summary?.label === 'Stack cashout' || rewardBurst?.tier === 'stack' || crescendo?.tier === 'stack' || laneCount >= 3) {
        return {
            action: rewardBurst?.action ?? 'Cash stack',
            beatCount: Math.max(4, crescendo?.beatCount ?? 0) as 4 | 5,
            label: 'Stack cashout',
            tier: 'stack',
            value: summary?.value ?? rewardBurst?.value ?? `${laneCount} payoff lanes`
        };
    }
    if (
        summary?.label === 'Route cashout' ||
        summary?.label === 'Pickup cashout' ||
        summary?.label === 'Trait cashout' ||
        summary?.label === 'Chain cashout' ||
        impactLabelLower.includes('cashout') ||
        crescendo?.tier === 'cashout'
    ) {
        return {
            action: rewardBurst?.action ?? 'Cash now',
            beatCount: Math.max(3, crescendo?.beatCount ?? 0) as 3 | 4 | 5,
            label: summary?.label ?? 'Cashout',
            tier: 'cashout',
            value: summary?.value ?? rewardBurst?.value ?? payload.routeRewardText ?? `+${runNonNegativeInteger(payload.amount).toLocaleString()}`
        };
    }
    return null;
};

export const getBoardFloaterJackpotAudioCue = (
    cue: MatchFloaterJackpotCue
): 'match-jackpot-cashout' | 'match-jackpot-stack' | 'match-jackpot-super' => {
    if (cue.tier === 'super') {
        return 'match-jackpot-super';
    }
    if (cue.tier === 'stack') {
        return 'match-jackpot-stack';
    }
    return 'match-jackpot-cashout';
};

export const getBoardFloaterJackpotScreenCue = (
    cue: MatchFloaterJackpotCue
): 'burst' | 'cashout' | 'super' => {
    if (cue.tier === 'super') {
        return 'super';
    }
    if (cue.tier === 'stack') {
        return 'burst';
    }
    return 'cashout';
};

export const getBoardFloaterPayoffLaneBeatCount = (
    lane: MatchScorePopPayoffLaneMapEntry
): 2 | 3 | 4 => {
    if (lane.tone === 'reward' || lane.tone === 'pickup' || lane.tone === 'route') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.tone === 'trait' || lane.tone === 'chain') {
        return 3;
    }
    return 2;
};

export const getBoardFloaterPayoffLaneAudioCue = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'match-payoff-route' | 'match-payoff-pickup' | 'match-payoff-trait' | 'match-payoff-chain' | 'match-payoff-reward' | 'match-payoff-prime' => {
    if (lane.tone === 'route') {
        return 'match-payoff-route';
    }
    if (lane.tone === 'pickup') {
        return 'match-payoff-pickup';
    }
    if (lane.tone === 'trait') {
        return 'match-payoff-trait';
    }
    if (lane.tone === 'chain') {
        return 'match-payoff-chain';
    }
    if (lane.tone === 'reward') {
        return 'match-payoff-reward';
    }
    return 'match-payoff-prime';
};

export const getBoardFloaterPayoffLaneScreenCue = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'burst' | 'route' | 'trait' | 'chain' | 'pulse' => {
    if (lane.tone === 'route' || lane.tone === 'pickup' || lane.tone === 'reward' || lane.count > 1) {
        return 'burst';
    }
    if (lane.tone === 'trait') {
        return 'trait';
    }
    if (lane.tone === 'chain') {
        return 'chain';
    }
    return 'pulse';
};

export const getBoardFloaterPayoffLaneFocus = (
    lane: MatchScorePopPayoffLaneMapEntry
): 'cashout' | 'route' | 'pickup' | 'trait' | 'chain' | 'reward' => {
    const action = matchPayoffLaneAction(lane).toLowerCase();
    const cue = lane.cue.toLowerCase();

    if (action.includes('cash') || cue.includes('cashout')) {
        return 'cashout';
    }

    return lane.tone;
};

export const getBoardFloaterTraitLaneAudioCue = (
    lane: TraitInteractionLaneMapEntry
): 'match-trait-shard' | 'match-trait-guard' | 'match-trait-risk' | 'match-trait-score' | 'match-trait-tool' | 'match-trait-block' | 'match-trait-recall' => {
    if (lane.id === 'shard') {
        return 'match-trait-shard';
    }
    if (lane.id === 'guard') {
        return 'match-trait-guard';
    }
    if (lane.id === 'risk') {
        return 'match-trait-risk';
    }
    if (lane.id === 'score') {
        return 'match-trait-score';
    }
    if (lane.id === 'tool') {
        return 'match-trait-tool';
    }
    if (lane.id === 'block') {
        return 'match-trait-block';
    }
    return 'match-trait-recall';
};

export const getBoardFloaterTraitLaneScreenCue = (
    lane: TraitInteractionLaneMapEntry
): 'burst' | 'guard' | 'risk' | 'control' | 'pulse' => {
    if (lane.count > 1 || lane.id === 'shard' || lane.id === 'score') {
        return 'burst';
    }
    if (lane.id === 'guard') {
        return 'guard';
    }
    if (lane.id === 'risk') {
        return 'risk';
    }
    if (lane.id === 'tool' || lane.id === 'block') {
        return 'control';
    }
    return 'pulse';
};

export const getBoardFloaterPayoffLadderBeatCount = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 3 | 4 | 5 => {
    const laneCount = matchPayoffLadderLanes(ladder.lanes).length;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 5;
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 4;
    }
    return 3;
};

export const getBoardFloaterPayoffLadderAudioCue = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 'payoff-ladder-chain' | 'payoff-ladder-reward' | 'payoff-ladder-super' => {
    const laneCount = matchPayoffLadderLanes(ladder.lanes).length;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 'payoff-ladder-super';
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 'payoff-ladder-reward';
    }
    return 'payoff-ladder-chain';
};

export const getBoardFloaterPayoffLadderScreenCue = (
    ladder: NonNullable<MatchScorePop['payoffLadder']>
): 'burst' | 'pulse' | 'super' => {
    const laneCount = matchPayoffLadderLanes(ladder.lanes).length;
    if (ladder.tone === 'combo' || laneCount >= 4) {
        return 'super';
    }
    if (ladder.tone === 'reward' || laneCount >= 2) {
        return 'burst';
    }
    return 'pulse';
};

export const getBoardFloaterTraitLaneBeatCount = (
    lane: TraitInteractionLaneMapEntry
): 2 | 3 | 4 => {
    if (lane.id === 'shard' || lane.id === 'guard') {
        return lane.count > 1 ? 4 : 3;
    }
    if (lane.id === 'risk' || lane.id === 'block') {
        return 3;
    }
    return 2;
};

export const getBoardFloaterChainMilestoneBeatCount = (
    milestone: NonNullable<MatchScorePop['chainMilestone']>
): 3 | 4 | 5 => {
    if (milestone.beatCount) {
        return milestone.beatCount;
    }
    if (milestone.tone === 'combo') {
        return 5;
    }
    if (milestone.tone === 'surge') {
        return 4;
    }
    return 3;
};

export const getMismatchFloaterHeat = (payload: MismatchScorePop): MismatchFloaterHeat => {
    const traitRiskCount = matchTraitInteractionTexts(payload.traitInteractionTexts).length;
    if (payload.brokenChainRewardCue) {
        return 'lost-reward';
    }
    if ((payload.brokenChainDepth ?? 0) >= 3) {
        return 'break';
    }
    if (traitRiskCount >= 2) {
        return 'trait-surge';
    }
    if (traitRiskCount > 0) {
        return 'risk';
    }
    return 'recover';
};

export const getMatchPayoffChipBeatCount = (chip: MatchPayoffChip): 1 | 2 | 3 | 4 => {
    const arcadeCue = chip.arcadeCue?.toLowerCase() ?? '';
    if (arcadeCue.includes('one-away') || arcadeCue.includes('cashout') || chip.id === 'chainReward' || chip.id === 'next') {
        return 4;
    }
    if (chip.id === 'pickup' || chip.id === 'route' || chip.id === 'trait' || chip.id === 'tier') {
        return 3;
    }
    if (chip.id === 'streak' || chip.id === 'cascade') {
        return 2;
    }
    return 1;
};

export const getMatchPayoffChipAudioCue = (
    chip: MatchPayoffChip
):
    | 'match-payoff-chain'
    | 'match-payoff-guard'
    | 'match-payoff-heal'
    | 'match-payoff-pickup'
    | 'match-payoff-reward'
    | 'match-payoff-route'
    | 'match-payoff-score'
    | 'match-payoff-trait' => {
    if (chip.tone === 'guard') {
        return 'match-payoff-guard';
    }
    if (chip.tone === 'heal') {
        return 'match-payoff-heal';
    }
    if (chip.tone === 'pickup') {
        return 'match-payoff-pickup';
    }
    if (chip.tone === 'route') {
        return 'match-payoff-route';
    }
    if (chip.tone === 'trait') {
        return 'match-payoff-trait';
    }
    if (chip.tone === 'reward' || chip.id === 'next' || chip.id === 'chainReward') {
        return 'match-payoff-reward';
    }
    if (chip.tone === 'chain' || chip.id === 'streak' || chip.id === 'cascade' || chip.id === 'tier') {
        return 'match-payoff-chain';
    }
    return 'match-payoff-score';
};

export const getMatchPayoffChipScreenCue = (
    chip: MatchPayoffChip
): 'burst' | 'chain' | 'guard' | 'heal' | 'pulse' | 'tick' | 'trait' => {
    const arcadeCue = chip.arcadeCue?.toLowerCase() ?? '';
    if (arcadeCue.includes('one-away') || arcadeCue.includes('cashout') || chip.id === 'next' || chip.id === 'chainReward') {
        return 'burst';
    }
    if (chip.tone === 'guard') {
        return 'guard';
    }
    if (chip.tone === 'heal') {
        return 'heal';
    }
    if (chip.tone === 'trait') {
        return 'trait';
    }
    if (chip.tone === 'pickup' || chip.tone === 'route' || chip.tone === 'reward') {
        return 'burst';
    }
    if (chip.tone === 'chain') {
        return 'chain';
    }
    return chip.id === 'score' ? 'tick' : 'pulse';
};

export const getBoardFloaterRewardForecastBeatCount = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 2 | 3 | 4 => {
    if (cue.urgency === 'next' || cue.distance <= 1 || (cue.stackSize ?? 1) >= 2) {
        return 4;
    }
    if (cue.urgency === 'soon' || cue.distance <= 2) {
        return 3;
    }
    return 2;
};

export const getBoardFloaterRewardForecastAudioCue = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 'chain-reward-guard' | 'chain-reward-heal' | 'chain-reward-prime' | 'chain-reward-shard' | 'chain-reward-stack' => {
    if ((cue.stackSize ?? 1) >= 2) {
        return 'chain-reward-stack';
    }
    if (cue.tone === 'guard') {
        return 'chain-reward-guard';
    }
    if (cue.tone === 'heal') {
        return 'chain-reward-heal';
    }
    if (cue.urgency === 'later') {
        return 'chain-reward-prime';
    }
    return 'chain-reward-shard';
};

export const getBoardFloaterRewardForecastScreenCue = (
    cue: NonNullable<MatchScorePop['chainRewardForecastCues']>[number]
): 'burst' | 'pulse' | 'tick' => {
    if ((cue.stackSize ?? 1) >= 2 || cue.urgency === 'next') {
        return 'burst';
    }
    if (cue.urgency === 'soon') {
        return 'pulse';
    }
    return 'tick';
};

export const getMismatchRecoveryChipBeatCount = (chip: MismatchFloaterRecoveryChip): 1 | 2 | 3 | 4 => {
    if (chip.arcadeCue === 'Lost cashout' || chip.urgency === 'one-away') {
        return 4;
    }
    if (chip.tone === 'risk' || chip.tone === 'chain') {
        return 3;
    }
    if (chip.tone === 'tool' || chip.tone === 'tempo') {
        return 2;
    }
    return 1;
};

export const getMismatchRecoveryChipAudioCue = (
    chip: MismatchFloaterRecoveryChip
):
    | 'mismatch-chip-chain'
    | 'mismatch-chip-lost'
    | 'mismatch-chip-recover'
    | 'mismatch-chip-risk'
    | 'mismatch-chip-tempo'
    | 'mismatch-chip-tool' => {
    if (chip.arcadeCue === 'Lost cashout') {
        return 'mismatch-chip-lost';
    }
    if (chip.tone === 'chain') {
        return 'mismatch-chip-chain';
    }
    if (chip.tone === 'risk') {
        return 'mismatch-chip-risk';
    }
    if (chip.tone === 'tool') {
        return 'mismatch-chip-tool';
    }
    if (chip.tone === 'tempo') {
        return 'mismatch-chip-tempo';
    }
    return 'mismatch-chip-recover';
};

export const getMismatchRecoveryChipScreenCue = (
    chip: MismatchFloaterRecoveryChip
): 'chain' | 'lost' | 'recover' | 'risk' | 'tempo' | 'tool' => {
    if (chip.arcadeCue === 'Lost cashout') {
        return 'lost';
    }
    if (chip.tone === 'chain') {
        return 'chain';
    }
    if (chip.tone === 'risk') {
        return 'risk';
    }
    if (chip.tone === 'tool') {
        return 'tool';
    }
    if (chip.tone === 'tempo') {
        return 'tempo';
    }
    return 'recover';
};
