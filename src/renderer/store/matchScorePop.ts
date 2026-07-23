import type { RunState } from '../../shared/contracts';
import { getMatchFloaterAnchorTileIds, getMismatchFloaterAnchorTileIds } from '../../shared/turn-resolution';
import { routeSpecialLabel, routeSpecialRewardLine } from '../../shared/route-world';
import { formatTileTraitInteractionTags, resolveTileTraitEffects } from '../../shared/tile-trait-rules';
import { getFindableKindLabel, getFindableRewardCopy } from '../../shared/findables';
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { getChainMilestoneFeedback, type ChainMilestoneFeedback } from '../copy/chainMilestoneFeedback';
import { detectClaimedFindableKind } from '../copy/hudActionFeedback';
import { getChainRewardForecastCues, getChainRewardUrgencyCopy, type ChainRewardForecastCue } from '../copy/chainMomentum';

export type MatchScorePop = {
    amount: number;
    chainDepth: number;
    chainMilestone?: MatchScorePopChainMilestone;
    cascadeCue?: MatchScorePopCascadeCue;
    rewardBurst?: MatchScorePopRewardBurst;
    feedbackHeadline: MatchScorePopHeadline;
    feedbackIntensity: MatchScorePopIntensity;
    feedbackSignal: MatchScorePopSignal;
    impactCue: MatchScorePopImpactCue;
    crescendo?: MatchScorePopCrescendo;
    chainRewardForecastCues?: ChainRewardForecastCue[];
    payoffSummary?: MatchScorePopPayoffSummary;
    payoffChips?: MatchScorePopPayoffChip[];
    payoffLaneMap?: MatchScorePopPayoffLaneMapEntry[];
    payoffLadder?: MatchScorePopPayoffLadder;
    chainRewardText?: string;
    pickupRewardText?: string;
    routeRewardText?: string;
    traitInteractionTexts?: string[];
    tileIdA: string;
    tileIdB: string;
    key: string;
};

export type MatchScorePopHeadline = 'Score pop' | 'Chain' | 'Surge' | 'Combo' | 'Reward';
export type MatchScorePopIntensity = 'low' | 'mid' | 'high' | 'max';
export type MatchScorePopChainMilestone = ChainMilestoneFeedback;
export type MatchScorePopCascadeCue = {
    label: 'Cascade';
    value: string;
    tier: 'chain' | 'reward' | 'combo';
};
export type MatchScorePopRewardBurst = {
    action: 'Cash now' | 'Cash stack' | 'Cash super stack' | 'Stack cashout';
    label: 'Reward hit' | 'Reward burst' | 'Combo burst' | 'Super stack';
    value: string;
    tier: 'single' | 'stack' | 'mega';
};
export type MatchScorePopSignal = {
    label: 'Score' | 'Chain' | 'Combo' | 'Trait' | 'Pickup' | 'Route';
    tone: 'score' | 'chain' | 'combo' | 'trait' | 'pickup' | 'route';
};

export type MatchScorePopImpactCue = {
    label:
        | 'Score pop'
        | 'Prime chain'
        | 'Cashout armed'
        | 'Combo hold'
        | 'Cashout now'
        | 'Route cashout'
        | 'Pickup cashout'
        | 'Trait cashout'
        | 'Perk pop'
        | 'Perk surge'
        | 'Trait surge'
        | 'Stack cashout'
        | 'Super stack';
    tone: 'score' | 'chain' | 'combo' | 'reward' | 'route' | 'pickup' | 'trait';
};

export type MatchScorePopCrescendo = {
    audioCue: 'score-pop' | 'prime-pop' | 'cashout-pop' | 'stack-burst' | 'super-burst';
    beatCount: 1 | 2 | 3 | 4 | 5;
    detail: string;
    label: 'Score pop' | 'Prime beat' | 'Cashout beat' | 'Stack burst' | 'Super burst';
    screenCue: 'tick' | 'pulse' | 'snap' | 'burst' | 'super';
    tier: 'score' | 'prime' | 'cashout' | 'stack' | 'super';
};

export type MatchScorePopPayoffChip = {
    arcadeCue?: string;
    id: 'score' | 'streak' | 'cascade' | 'tier' | 'trait' | 'pickup' | 'route' | 'chainReward' | 'next';
    label: string;
    value: string;
    tone: 'score' | 'chain' | 'trait' | 'pickup' | 'route' | 'reward' | 'guard' | 'heal';
};

export type MatchScorePopPayoffLaneId = 'route' | 'pickup' | 'trait' | 'chain' | 'build';

export type MatchScorePopPayoffLaneMapEntry = {
    id: MatchScorePopPayoffLaneId;
    label: 'Route' | 'Pickup' | 'Trait' | 'Chain' | 'Build';
    count: number;
    tone: 'route' | 'pickup' | 'trait' | 'chain' | 'reward';
    cue: string;
};

export type MatchScorePopPayoffSummary = {
    label:
        | 'Score hit'
        | 'Chain hit'
        | 'Cashout armed'
        | 'Combo hit'
        | 'Route cashout'
        | 'Pickup cashout'
        | 'Trait cashout'
        | 'Perk pop'
        | 'Perk surge'
        | 'Trait surge'
        | 'Chain cashout'
        | 'Stack cashout'
        | 'Super stack';
    value: string;
    tier: 'score' | 'chain' | 'combo' | 'reward';
};

export type MatchScorePopPayoffLadder = {
    first: string;
    keep: string;
    lanes?: string[];
    then: string;
    tone: 'chain' | 'combo' | 'reward';
};

export type MismatchScorePop = {
    tileIdA: string;
    tileIdB: string;
    /** Gambit triple-miss only — centroid anchor for GameScreen. */
    tileIdC?: string;
    brokenChainDepth?: number;
    brokenChainRewardCue?: ChainRewardForecastCue;
    traitInteractionTexts?: string[];
    key: string;
};

/** Spread into Zustand `set` / `useAppStore.setState` to clear both board floaters in one patch. */
export const BOARD_FLOATER_POP_CLEAR = {
    matchScorePop: null as MatchScorePop | null,
    mismatchScorePop: null as MismatchScorePop | null
};

const getTilesByIds = (run: RunState, tileIds: readonly string[]) =>
    tileIds
        .map((tileId) => run.board?.tiles.find((tile) => tile.id === tileId))
        .filter((tile): tile is NonNullable<RunState['board']>['tiles'][number] => tile != null);

const resolveTraitInteractionTexts = (
    run: RunState,
    tileIds: readonly string[],
    source: 'match' | 'mismatch'
): string[] => {
    if (!run.board) {
        return [];
    }
    const sourceTiles = getTilesByIds(run, tileIds);
    if (sourceTiles.length === 0) {
        return [];
    }
    return formatTileTraitInteractionTags(
        resolveTileTraitEffects({
            run,
            board: run.board,
            sourceTiles,
            source
        }).interactionTags
    );
};

const nextRewardPayoffLabel = (cue: ChainRewardForecastCue): string => {
    if (cue.tone === 'guard') {
        return `${cue.actionLabel} guard`;
    }
    if (cue.tone === 'heal') {
        return `${cue.actionLabel} life`;
    }
    return `${cue.actionLabel} shard`;
};

const formatGain = (amount: number, singular: string, plural = `${singular}s`): string =>
    `+${amount} ${amount === 1 ? singular : plural}`;

const isRewardPerkInteractionText = (text: string): boolean => text.startsWith('Perk pop: ');

const isRewardPerkOnlyTraitBurst = (traitInteractionTexts: readonly string[]): boolean =>
    traitInteractionTexts.length > 0 && traitInteractionTexts.every(isRewardPerkInteractionText);

const buildChainRewardText = (before: RunState, after: RunState, chainDepth: number): string | undefined => {
    if (chainDepth < 3) {
        return undefined;
    }
    const comboShardGain = Math.max(0, (after.stats.comboShards ?? 0) - (before.stats.comboShards ?? 0));
    const guardGain = Math.max(0, (after.stats.guardTokens ?? 0) - (before.stats.guardTokens ?? 0));
    const lifeGain = Math.max(0, (after.lives ?? 0) - (before.lives ?? 0));
    const parts = [
        comboShardGain > 0 ? formatGain(comboShardGain, 'combo shard') : null,
        guardGain > 0 ? formatGain(guardGain, 'guard token') : null,
        lifeGain > 0 ? formatGain(lifeGain, 'life', 'lives') : null
    ].filter((part): part is string => part != null);
    return parts.length > 0 ? parts.join(' / ') : undefined;
};

export const getMatchScorePopChainMilestone = (
    previousStreak: number,
    nextStreak: number
): MatchScorePopChainMilestone | undefined => getChainMilestoneFeedback(previousStreak, nextStreak);

export const getMatchScorePopFeedbackProfile = (
    chainDepth: number,
    traitInteractionCount: number
): Pick<MatchScorePop, 'feedbackHeadline' | 'feedbackIntensity'> => {
    const depth = Math.max(1, Math.floor(chainDepth));
    if (depth >= 10 || traitInteractionCount >= 2) {
        return { feedbackHeadline: 'Combo', feedbackIntensity: 'max' };
    }
    if (depth >= 6 || traitInteractionCount >= 1) {
        return { feedbackHeadline: 'Surge', feedbackIntensity: 'high' };
    }
    if (depth >= 3) {
        return { feedbackHeadline: 'Chain', feedbackIntensity: 'mid' };
    }
    return { feedbackHeadline: 'Score pop', feedbackIntensity: 'low' };
};

export const getMatchScorePopSignal = ({
    chainDepth,
    hasPickupReward,
    hasRouteReward,
    traitInteractionCount
}: {
    chainDepth: number;
    hasPickupReward: boolean;
    hasRouteReward: boolean;
    traitInteractionCount: number;
}): MatchScorePopSignal => {
    if (hasRouteReward) {
        return { label: 'Route', tone: 'route' };
    }
    if (hasPickupReward) {
        return { label: 'Pickup', tone: 'pickup' };
    }
    if (traitInteractionCount > 0) {
        return { label: 'Trait', tone: 'trait' };
    }
    if (chainDepth >= 10) {
        return { label: 'Combo', tone: 'combo' };
    }
    if (chainDepth >= 3) {
        return { label: 'Chain', tone: 'chain' };
    }
    return { label: 'Score', tone: 'score' };
};

const buildMatchScorePopRewardBurst = ({
    chainDepth,
    chainMilestone,
    chainRewardText,
    pickupRewardText,
    routeRewardText,
    traitInteractionTexts
}: {
    chainDepth: number;
    chainMilestone?: MatchScorePopChainMilestone;
    chainRewardText?: string;
    pickupRewardText?: string;
    routeRewardText?: string;
    traitInteractionTexts: readonly string[];
}): MatchScorePopRewardBurst | undefined => {
    const channels = [
        routeRewardText ? 'Route' : null,
        pickupRewardText ? 'Pickup' : null,
        chainRewardText ? 'Chain reward' : null,
        ...traitInteractionTexts.slice(0, 2).map((_, index) => (index === 0 ? 'Trait' : 'Trait surge')),
        chainMilestone ? chainMilestone.label : null,
        chainDepth >= 6 ? 'Momentum' : null
    ].filter((channel): channel is string => Boolean(channel));

    if (channels.length === 0) {
        return undefined;
    }

    if (channels.length >= 4) {
        return {
            action: 'Cash super stack',
            label: 'Super stack',
            value: `${channels.length}-way payoff`,
            tier: 'mega'
        };
    }

    if (channels.length >= 3) {
        return {
            action: 'Cash stack',
            label: 'Combo burst',
            value: `${channels.length}-way payoff`,
            tier: 'mega'
        };
    }

    if (channels.length === 2) {
        return {
            action: 'Stack cashout',
            label: 'Reward burst',
            value: `${channels.length}-way payoff`,
            tier: 'stack'
        };
    }

    return {
        action: 'Cash now',
        label: 'Reward hit',
        value: channels[0],
        tier: 'single'
    };
};

const buildMatchScorePopCascadeCue = ({
    chainDepth,
    chainRewardText,
    pickupRewardText,
    routeRewardText,
    traitInteractionTexts
}: {
    chainDepth: number;
    chainRewardText?: string;
    pickupRewardText?: string;
    routeRewardText?: string;
    traitInteractionTexts: readonly string[];
}): MatchScorePopCascadeCue | undefined => {
    const rewardChannels = [
        routeRewardText,
        pickupRewardText,
        chainRewardText,
        ...traitInteractionTexts.slice(0, 2)
    ].filter(Boolean).length;
    const channels = [
        rewardChannels > 0 ? 'reward' : null,
        chainDepth >= 3 ? 'chain' : null
    ].filter(Boolean).length;
    if (chainDepth < 3 && channels < 2) {
        return undefined;
    }
    if (chainDepth >= 10 || rewardChannels >= 3 || traitInteractionTexts.length >= 2) {
        return { label: 'Cascade', value: 'combo cascade', tier: 'combo' };
    }
    if (chainDepth >= 6 || rewardChannels >= 2 || (rewardChannels >= 1 && chainDepth >= 3)) {
        return { label: 'Cascade', value: 'reward cascade', tier: 'reward' };
    }
    return { label: 'Cascade', value: 'chain cascade', tier: 'chain' };
};

const buildMatchScorePopPayoffChips = ({
    amount,
    cascadeCue,
    chainDepth,
    chainRewardForecastCues,
    chainRewardText,
    pickupRewardText,
    routeRewardText,
    traitInteractionTexts
}: {
    amount: number;
    cascadeCue?: MatchScorePopCascadeCue;
    chainDepth: number;
    chainRewardForecastCues: readonly ChainRewardForecastCue[];
    chainRewardText?: string;
    pickupRewardText?: string;
    routeRewardText?: string;
    traitInteractionTexts: readonly string[];
}): MatchScorePopPayoffChip[] => {
    const scoreChip: MatchScorePopPayoffChip = {
        arcadeCue: 'Score pop',
        id: 'score',
        label: 'Score',
        value: `+${runNonNegativeInteger(amount).toLocaleString()}`,
        tone: 'score'
    };
    const metaChips: MatchScorePopPayoffChip[] = [];
    const cashoutChips: MatchScorePopPayoffChip[] = [];
    const nextChips: MatchScorePopPayoffChip[] = [];
    const nextReward = chainRewardForecastCues[0];
    if (chainDepth >= 3) {
        metaChips.push({
            arcadeCue: chainDepth >= 6 ? 'Chain cashout' : nextReward ? 'Prime cashout' : 'Keep streak',
            id: 'streak',
            label: 'Streak',
            value: `x${Math.floor(chainDepth)}`,
            tone: 'chain'
        });
    }
    if (cascadeCue) {
        metaChips.push({
            arcadeCue: cascadeCue.tier === 'combo' ? 'Combo cascade' : cascadeCue.tier === 'reward' ? 'Reward cascade' : 'Chain cascade',
            id: 'cascade',
            label: cascadeCue.label,
            value: cascadeCue.value,
            tone: cascadeCue.tier === 'combo' ? 'reward' : 'chain'
        });
    }
    if (chainDepth >= 6) {
        metaChips.push({
            arcadeCue: chainDepth >= 10 ? 'Combo live' : 'Surge live',
            id: 'tier',
            label: 'Momentum',
            value: chainDepth >= 10 ? 'Combo live' : 'Surge live',
            tone: 'chain'
        });
    }
    if (routeRewardText) {
        cashoutChips.push({
            arcadeCue: 'Route cashout',
            id: 'route',
            label: 'Route',
            value: routeRewardText,
            tone: 'route'
        });
    }
    if (pickupRewardText) {
        cashoutChips.push({
            arcadeCue: 'Pickup cashout',
            id: 'pickup',
            label: 'Pickup',
            value: pickupRewardText,
            tone: 'pickup'
        });
    }
    if (traitInteractionTexts[0]) {
        const perkOnlyBurst = isRewardPerkOnlyTraitBurst(traitInteractionTexts);
        cashoutChips.push({
            arcadeCue: perkOnlyBurst ? 'Perk pop' : traitInteractionTexts.length >= 2 ? 'Trait surge' : 'Trait cashout',
            id: 'trait',
            label: perkOnlyBurst
                ? traitInteractionTexts.length >= 2
                    ? 'Perk surge'
                    : 'Perk'
                : traitInteractionTexts.length >= 2
                  ? 'Trait surge'
                  : 'Trait',
            value: traitInteractionTexts.length >= 2
                ? perkOnlyBurst
                    ? `${traitInteractionTexts.length} perk pops`
                    : `${traitInteractionTexts.length} interactions`
                : traitInteractionTexts[0],
            tone: 'trait'
        });
    }
    if (chainRewardText) {
        cashoutChips.push({
            arcadeCue: 'Chain cashout',
            id: 'chainReward',
            label: 'Cashout',
            value: chainRewardText,
            tone: 'reward'
        });
    }
    if (nextReward) {
        nextChips.push({
            arcadeCue: getChainRewardUrgencyCopy(nextReward),
            id: 'next',
            label: nextRewardPayoffLabel(nextReward),
            value: nextReward.label,
            tone: nextReward.tone
        });
    }

    if (cashoutChips.length >= 3) {
        return [scoreChip, ...cashoutChips, ...nextChips].slice(0, 5);
    }

    return [scoreChip, ...metaChips, ...cashoutChips, ...nextChips].slice(0, 5);
};

const MATCH_PAYOFF_LANE_ORDER: MatchScorePopPayoffLaneId[] = ['route', 'pickup', 'trait', 'chain', 'build'];

const MATCH_PAYOFF_LANE_LABELS: Record<MatchScorePopPayoffLaneId, MatchScorePopPayoffLaneMapEntry['label']> = {
    build: 'Build',
    chain: 'Chain',
    pickup: 'Pickup',
    route: 'Route',
    trait: 'Trait'
};

const MATCH_PAYOFF_LANE_TONES: Record<MatchScorePopPayoffLaneId, MatchScorePopPayoffLaneMapEntry['tone']> = {
    build: 'reward',
    chain: 'chain',
    pickup: 'pickup',
    route: 'route',
    trait: 'trait'
};

const getMatchScorePopPayoffLaneId = (chip: MatchScorePopPayoffChip): MatchScorePopPayoffLaneId | null => {
    switch (chip.id) {
        case 'route':
            return 'route';
        case 'pickup':
            return 'pickup';
        case 'trait':
            return 'trait';
        case 'chainReward':
        case 'streak':
        case 'cascade':
        case 'tier':
            return 'chain';
        case 'next':
            return 'build';
        case 'score':
            return null;
        default:
            return null;
    }
};

export const buildMatchScorePopPayoffLaneMap = (
    payoffChips: readonly MatchScorePopPayoffChip[]
): MatchScorePopPayoffLaneMapEntry[] | undefined => {
    const laneState = new Map<MatchScorePopPayoffLaneId, { count: number; cue: string }>();
    payoffChips.forEach((chip) => {
        const laneId = getMatchScorePopPayoffLaneId(chip);
        if (!laneId) {
            return;
        }
        const state = laneState.get(laneId);
        if (state) {
            state.count += 1;
            return;
        }
        laneState.set(laneId, { count: 1, cue: chip.arcadeCue ?? chip.label });
    });

    const laneMap = MATCH_PAYOFF_LANE_ORDER.flatMap((id) => {
        const state = laneState.get(id);
        if (!state) {
            return [];
        }
        return [
            {
                id,
                label: MATCH_PAYOFF_LANE_LABELS[id],
                count: state.count,
                tone: MATCH_PAYOFF_LANE_TONES[id],
                cue: state.cue
            }
        ];
    });

    return laneMap.length > 0 ? laneMap : undefined;
};

export const buildMatchScorePopPayoffSummary = ({
    amount,
    chainDepth,
    chainRewardForecastCues = [],
    chainRewardText,
    pickupRewardText,
    routeRewardText,
    traitInteractionTexts
}: {
    amount: number;
    chainDepth: number;
    chainRewardForecastCues?: readonly ChainRewardForecastCue[];
    chainRewardText?: string;
    pickupRewardText?: string;
    routeRewardText?: string;
    traitInteractionTexts: readonly string[];
}): MatchScorePopPayoffSummary => {
    const cashoutChannels = [
        routeRewardText ? 'Route' : null,
        pickupRewardText ? 'Pickup' : null,
        traitInteractionTexts[0] ? 'Trait' : null,
        chainRewardText ? 'Chain' : null
    ].filter((channel): channel is string => channel != null);
    if (cashoutChannels.length >= 4) {
        return {
            label: 'Super stack',
            value: `${cashoutChannels.length} payoffs: ${cashoutChannels.join(' + ')}`,
            tier: 'combo'
        };
    }
    if (cashoutChannels.length >= 2) {
        return {
            label: 'Stack cashout',
            value: `${cashoutChannels.length} payoffs: ${cashoutChannels.join(' + ')}`,
            tier: 'reward'
        };
    }
    if (routeRewardText) {
        return { label: 'Route cashout', value: routeRewardText, tier: 'reward' };
    }
    if (pickupRewardText) {
        return { label: 'Pickup cashout', value: pickupRewardText, tier: 'reward' };
    }
    if (traitInteractionTexts[0]) {
        const perkOnlyBurst = isRewardPerkOnlyTraitBurst(traitInteractionTexts);
        if (traitInteractionTexts.length >= 2) {
            return {
                label: perkOnlyBurst ? 'Perk surge' : 'Trait surge',
                value: perkOnlyBurst ? `${traitInteractionTexts.length} perk pops` : `${traitInteractionTexts.length} interactions`,
                tier: 'combo'
            };
        }
        return { label: perkOnlyBurst ? 'Perk pop' : 'Trait cashout', value: traitInteractionTexts[0], tier: 'reward' };
    }
    if (chainRewardText) {
        return { label: 'Chain cashout', value: chainRewardText, tier: 'reward' };
    }
    const nextReward = chainRewardForecastCues[0];
    if (nextReward?.urgency === 'next') {
        return { label: 'Cashout armed', value: nextReward.label, tier: 'reward' };
    }
    if (chainDepth >= 10) {
        return { label: 'Combo hit', value: `x${Math.floor(chainDepth)} streak`, tier: 'combo' };
    }
    if (chainDepth >= 3) {
        return { label: 'Chain hit', value: `x${Math.floor(chainDepth)} streak`, tier: 'chain' };
    }
    return { label: 'Score hit', value: `+${runNonNegativeInteger(amount).toLocaleString()}`, tier: 'score' };
};

export const buildMatchScorePopImpactCue = ({
    chainDepth,
    payoffSummary,
    rewardBurst
}: {
    chainDepth: number;
    payoffSummary: MatchScorePopPayoffSummary;
    rewardBurst?: MatchScorePopRewardBurst;
}): MatchScorePopImpactCue => {
    if (payoffSummary.label === 'Super stack' || rewardBurst?.label === 'Super stack') {
        return { label: 'Super stack', tone: 'reward' };
    }
    if (payoffSummary.label === 'Stack cashout' || rewardBurst?.tier === 'mega') {
        return { label: 'Stack cashout', tone: 'reward' };
    }
    if (payoffSummary.label === 'Route cashout') {
        return { label: 'Route cashout', tone: 'route' };
    }
    if (payoffSummary.label === 'Pickup cashout') {
        return { label: 'Pickup cashout', tone: 'pickup' };
    }
    if (payoffSummary.label === 'Perk surge') {
        return { label: 'Perk surge', tone: 'trait' };
    }
    if (payoffSummary.label === 'Trait surge') {
        return { label: 'Trait surge', tone: 'trait' };
    }
    if (payoffSummary.label === 'Perk pop') {
        return { label: 'Perk pop', tone: 'trait' };
    }
    if (payoffSummary.label === 'Trait cashout') {
        return { label: 'Trait cashout', tone: 'trait' };
    }
    if (payoffSummary.label === 'Chain cashout') {
        return { label: 'Cashout now', tone: 'reward' };
    }
    if (payoffSummary.label === 'Cashout armed') {
        return { label: 'Cashout armed', tone: 'reward' };
    }
    if (chainDepth >= 10) {
        return { label: 'Combo hold', tone: 'combo' };
    }
    if (chainDepth >= 3) {
        return { label: 'Prime chain', tone: 'chain' };
    }
    return { label: 'Score pop', tone: 'score' };
};

const buildMatchScorePopPayoffLadder = ({
    chainRewardForecastCues = [],
    impactCue,
    payoffChips,
    payoffSummary,
    rewardBurst
}: {
    chainRewardForecastCues?: readonly ChainRewardForecastCue[];
    impactCue: MatchScorePopImpactCue;
    payoffChips: readonly MatchScorePopPayoffChip[];
    payoffSummary: MatchScorePopPayoffSummary;
    rewardBurst?: MatchScorePopRewardBurst;
}): MatchScorePopPayoffLadder | undefined => {
    if (payoffSummary.tier === 'score' && payoffChips.length <= 1) {
        return undefined;
    }

    const cashoutChip =
        payoffChips.find((chip) => chip.id === 'route') ??
        payoffChips.find((chip) => chip.id === 'pickup') ??
        payoffChips.find((chip) => chip.id === 'trait') ??
        payoffChips.find((chip) => chip.id === 'chainReward');
    const cashoutLanes = payoffChips
        .filter((chip) => chip.id === 'route' || chip.id === 'pickup' || chip.id === 'trait' || chip.id === 'chainReward')
        .map((chip) => chip.arcadeCue ?? chip.label)
        .slice(0, 4);
    const firstChip = cashoutChip ?? payoffChips.find((chip) => chip.id !== 'score') ?? payoffChips[0];
    const nextRewardChip = payoffChips.find((chip) => chip.id === 'next');
    const nextRewardCue = chainRewardForecastCues[0];
    const tone =
        payoffSummary.tier === 'combo'
            ? 'combo'
            : payoffSummary.tier === 'reward'
              ? 'reward'
              : 'chain';

    return {
        first: firstChip?.arcadeCue ?? impactCue.label,
        ...(cashoutLanes.length >= 2 ? { lanes: cashoutLanes } : {}),
        then: nextRewardChip?.arcadeCue ?? rewardBurst?.action ?? payoffSummary.label,
        keep: nextRewardCue?.chaseLabel ?? nextRewardChip?.value ?? 'Keep streak alive',
        tone
    };
};

const matchScorePopLaneCount = (payoffLaneMap: readonly MatchScorePopPayoffLaneMapEntry[] | undefined): number =>
    Array.isArray(payoffLaneMap)
        ? payoffLaneMap.reduce(
              (total, lane) =>
                  total + (typeof lane.count === 'number' && Number.isFinite(lane.count) ? Math.max(0, Math.floor(lane.count)) : 0),
              0
          )
        : 0;

export const buildMatchScorePopCrescendo = ({
    chainDepth,
    impactCue,
    payoffLaneMap,
    payoffSummary,
    rewardBurst
}: {
    chainDepth: number;
    impactCue: MatchScorePopImpactCue;
    payoffLaneMap?: readonly MatchScorePopPayoffLaneMapEntry[];
    payoffSummary: MatchScorePopPayoffSummary;
    rewardBurst?: MatchScorePopRewardBurst;
}): MatchScorePopCrescendo => {
    const laneCount = matchScorePopLaneCount(payoffLaneMap);

    if (impactCue.label === 'Super stack' || rewardBurst?.label === 'Super stack' || laneCount >= 4) {
        return {
            audioCue: 'super-burst',
            beatCount: 5,
            detail: `${Math.max(4, laneCount)} payoff lanes`,
            label: 'Super burst',
            screenCue: 'super',
            tier: 'super'
        };
    }

    if (impactCue.label === 'Stack cashout' || rewardBurst != null || laneCount >= 2) {
        return {
            audioCue: 'stack-burst',
            beatCount: 4,
            detail: `${Math.max(2, laneCount)} payoff lanes`,
            label: 'Stack burst',
            screenCue: 'burst',
            tier: 'stack'
        };
    }

    if (
        payoffSummary.tier === 'reward' ||
        impactCue.label === 'Cashout armed' ||
        impactCue.label === 'Cashout now' ||
        impactCue.label === 'Route cashout' ||
        impactCue.label === 'Pickup cashout' ||
        impactCue.label === 'Trait cashout'
    ) {
        return {
            audioCue: 'cashout-pop',
            beatCount: 3,
            detail: payoffSummary.value,
            label: 'Cashout beat',
            screenCue: 'snap',
            tier: 'cashout'
        };
    }

    if (chainDepth >= 3 || payoffSummary.tier === 'chain' || payoffSummary.tier === 'combo') {
        return {
            audioCue: 'prime-pop',
            beatCount: 2,
            detail: `x${Math.floor(chainDepth)} streak`,
            label: 'Prime beat',
            screenCue: 'pulse',
            tier: 'prime'
        };
    }

    return {
        audioCue: 'score-pop',
        beatCount: 1,
        detail: payoffSummary.value,
        label: 'Score pop',
        screenCue: 'tick',
        tier: 'score'
    };
};

/**
 * Pure payload for the floating +score floater after a successful match resolve.
 */
export function buildMatchScorePopPayload(
    run: RunState | null,
    next: RunState,
    keyNonce?: string
): MatchScorePop | null {
    if (!run?.board) {
        return null;
    }
    const anchor = getMatchFloaterAnchorTileIds(run);
    if (!anchor) {
        return null;
    }
    if (next.stats.matchesFound <= run.stats.matchesFound) {
        return null;
    }
    const amount = next.stats.totalScore - run.stats.totalScore;
    if (!Number.isFinite(amount) || amount <= 0) {
        return null;
    }
    const { tileIdA, tileIdB } = anchor;
    const routeKind =
        run.board.tiles.find((tile) => tile.id === tileIdA)?.routeSpecialKind ??
        run.board.tiles.find((tile) => tile.id === tileIdB)?.routeSpecialKind ??
        run.board.tiles.find((tile) => tile.id === tileIdA)?.routeCardKind ??
        run.board.tiles.find((tile) => tile.id === tileIdB)?.routeCardKind ??
        null;
    const routeRewardText = routeKind ? `${routeSpecialLabel(routeKind)} ${routeSpecialRewardLine(routeKind)}` : undefined;
    const claimedFindableKind = next.board ? detectClaimedFindableKind(run.board.tiles, next.board.tiles) : null;
    const pickupRewardText = claimedFindableKind
        ? `${getFindableKindLabel(claimedFindableKind)} ${getFindableRewardCopy(claimedFindableKind)}`
        : undefined;
    const traitInteractionTexts = resolveTraitInteractionTexts(run, [tileIdA, tileIdB], 'match');
    const chainDepth = Number.isFinite(next.stats.currentStreak) ? Math.max(1, next.stats.currentStreak) : 1;
    const chainRewardText = buildChainRewardText(run, next, chainDepth);
    const chainMilestone = getMatchScorePopChainMilestone(run.stats.currentStreak, chainDepth);
    const feedbackProfile = pickupRewardText || chainRewardText
        ? { feedbackHeadline: 'Reward' as const, feedbackIntensity: 'high' as const }
        : getMatchScorePopFeedbackProfile(chainDepth, traitInteractionTexts.length);
    const feedbackSignal = getMatchScorePopSignal({
        chainDepth,
        hasPickupReward: Boolean(pickupRewardText),
        hasRouteReward: Boolean(routeRewardText),
        traitInteractionCount: traitInteractionTexts.length
    });
    const nonce = keyNonce ?? `${Date.now()}`;
    const key = `${run.board.level}-${nonce}-${tileIdA}-${tileIdB}`;
    const chainRewardForecastCues =
        chainDepth >= 3 ? getChainRewardForecastCues(chainDepth, next.stats.comboShards, next.lives) : [];
    const rewardBurst = buildMatchScorePopRewardBurst({
        chainDepth,
        chainMilestone,
        chainRewardText,
        pickupRewardText,
        routeRewardText,
        traitInteractionTexts
    });
    const cascadeCue = buildMatchScorePopCascadeCue({
        chainDepth,
        chainRewardText,
        pickupRewardText,
        routeRewardText,
        traitInteractionTexts
    });
    const payoffChips = buildMatchScorePopPayoffChips({
        amount,
        cascadeCue,
        chainDepth,
        chainRewardForecastCues,
        chainRewardText,
        pickupRewardText,
        routeRewardText,
        traitInteractionTexts
    });
    const payoffLaneMap = buildMatchScorePopPayoffLaneMap(payoffChips);
    const payoffSummary = buildMatchScorePopPayoffSummary({
        amount,
        chainDepth,
        chainRewardForecastCues,
        chainRewardText,
        pickupRewardText,
        routeRewardText,
        traitInteractionTexts
    });
    const impactCue = buildMatchScorePopImpactCue({
        chainDepth,
        payoffSummary,
        rewardBurst
    });
    const payoffLadder = buildMatchScorePopPayoffLadder({
        chainRewardForecastCues,
        impactCue,
        payoffChips,
        payoffSummary,
        rewardBurst
    });
    const crescendo = buildMatchScorePopCrescendo({
        chainDepth,
        impactCue,
        payoffLaneMap,
        payoffSummary,
        rewardBurst
    });
    const payload: MatchScorePop = {
        amount,
        chainDepth,
        ...feedbackProfile,
        feedbackSignal,
        impactCue,
        crescendo,
        payoffSummary,
        payoffChips,
        tileIdA,
        tileIdB,
        key
    };
    if (chainMilestone) {
        payload.chainMilestone = chainMilestone;
    }
    if (cascadeCue) {
        payload.cascadeCue = cascadeCue;
    }
    if (rewardBurst) {
        payload.rewardBurst = rewardBurst;
    }
    if (payoffLadder) {
        payload.payoffLadder = payoffLadder;
    }
    if (payoffLaneMap) {
        payload.payoffLaneMap = payoffLaneMap;
    }
    if (chainRewardForecastCues.length > 0) {
        payload.chainRewardForecastCues = chainRewardForecastCues;
    }
    if (chainRewardText) {
        payload.chainRewardText = chainRewardText;
    }
    if (routeRewardText) {
        payload.routeRewardText = routeRewardText;
    }
    if (pickupRewardText) {
        payload.pickupRewardText = pickupRewardText;
    }
    if (traitInteractionTexts.length > 0) {
        payload.traitInteractionTexts = traitInteractionTexts;
    }
    return payload;
}

/**
 * Pure payload for the floating miss floater after a mismatch resolve.
 */
export function buildMismatchScorePopPayload(
    run: RunState | null,
    next: RunState,
    keyNonce?: string
): MismatchScorePop | null {
    if (!run?.board) {
        return null;
    }
    const anchor = getMismatchFloaterAnchorTileIds(run);
    if (!anchor) {
        return null;
    }
    if (next.stats.mismatches <= run.stats.mismatches) {
        return null;
    }
    const nonce = keyNonce ?? `${Date.now()}`;
    const { tileIdA, tileIdB, tileIdC } = anchor;
    const key = tileIdC
        ? `miss-${run.board.level}-${nonce}-${tileIdA}-${tileIdB}-${tileIdC}`
        : `miss-${run.board.level}-${nonce}-${tileIdA}-${tileIdB}`;
    const traitInteractionTexts = resolveTraitInteractionTexts(
        run,
        tileIdC ? [tileIdA, tileIdB, tileIdC] : [tileIdA, tileIdB],
        'mismatch'
    );
    const previousStreak = Number.isFinite(run.stats.currentStreak) ? Math.floor(run.stats.currentStreak) : 0;
    const nextStreak = Number.isFinite(next.stats.currentStreak) ? Math.floor(next.stats.currentStreak) : 0;
    const brokenChainDepth = previousStreak > 1 && nextStreak < previousStreak ? previousStreak : 0;
    const payload: MismatchScorePop = { tileIdA, tileIdB, key };
    if (tileIdC !== undefined) {
        payload.tileIdC = tileIdC;
    }
    if (brokenChainDepth > 0) {
        payload.brokenChainDepth = brokenChainDepth;
        const brokenChainRewardCue = getChainRewardForecastCues(
            brokenChainDepth,
            run.stats.comboShards,
            run.lives
        )[0];
        if (brokenChainRewardCue) {
            payload.brokenChainRewardCue = brokenChainRewardCue;
        }
    }
    if (traitInteractionTexts.length > 0) {
        payload.traitInteractionTexts = traitInteractionTexts;
    }
    return payload;
}
