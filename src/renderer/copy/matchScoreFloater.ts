/**
 * Match-score floater live region (`aria-live`). Centralized for a11y review and future i18n.
 */
import { getChainMomentumCue } from './chainMomentum';

export const matchScoreFloaterChainCue = getChainMomentumCue;

const PAYOFF_LANE_LIVE_ACTIONS: Readonly<Record<string, string>> = {
    Route: 'Cash route',
    Pickup: 'Claim pickup',
    Trait: 'Cash trait',
    Chain: 'Cash chain'
};

const PAYOFF_LANE_LIVE_ROLES: Readonly<Record<string, string>> = {
    Route: 'Route',
    Pickup: 'Claim',
    Trait: 'Trait',
    Chain: 'Chain'
};

const TRAIT_LANE_LIVE_ACTIONS: Readonly<Record<string, string>> = {
    Block: 'Deny match',
    Guard: 'Protect run',
    Recall: 'Set memory',
    Risk: 'Watch hazard',
    Score: 'Cash score',
    Shard: 'Cash shard',
    Tool: 'Use tool'
};

const enrichPayoffLaneMapLiveText = (text: string): string =>
    Object.entries(PAYOFF_LANE_LIVE_ACTIONS).reduce((current, [lane, action]) => {
        const role = PAYOFF_LANE_LIVE_ROLES[lane] ?? lane;
        const actionPattern = action.replace(/\s+/gu, '\\s+');
        const explicitOldLanePattern = new RegExp(`\\b${lane}:\\s+(\\d+)\\.\\s+(${actionPattern}\\.)`, 'gu');
        const oldLanePattern = new RegExp(`\\b${lane}:\\s+(\\d+)\\.\\s+(?!${actionPattern}\\.)`, 'gu');
        const roleLanePattern = new RegExp(`\\b${lane}\\s+${role}\\s+x(\\d+)\\.\\s+(?!${actionPattern}\\.)`, 'gu');
        return current
            .replace(explicitOldLanePattern, `${lane} ${role} x$1. $2`)
            .replace(oldLanePattern, `${lane} ${role} x$1. ${action}. `)
            .replace(roleLanePattern, `${lane} ${role} x$1. ${action}. `);
    }, text);

const enrichTraitLaneMapLiveText = (text: string): string =>
    Object.entries(TRAIT_LANE_LIVE_ACTIONS).reduce((current, [lane, action]) => {
        const lanePattern = new RegExp(`(${lane}:\\s+\\d+\\.\\s+)(?!${action.replace(/\s+/gu, '\\s+')}\\.)`, 'gu');
        return current.replace(lanePattern, `$1${action}. `);
    }, text);

export function matchScoreFloaterLiveRegionText(
    amount: number,
    traitInteractionTexts: readonly string[] = [],
    feedbackHeadline?: string,
    chainDepth?: number,
    chainRewardForecastTexts: readonly string[] = [],
    rewardBurstText?: string,
    cascadeText?: string,
    payoffSummaryText?: string,
    impactCueText?: string,
    payoffLaneMapText?: string,
    traitLaneMapText?: string,
    crescendoText?: string,
    chainMilestoneText?: string
): string {
    const base = `Plus ${amount.toLocaleString()} points`;
    const headline = feedbackHeadline ? `${feedbackHeadline}. ` : '';
    const chainCue = matchScoreFloaterChainCue(chainDepth);
    const streak =
        chainDepth != null && Number.isFinite(chainDepth) && chainDepth >= 3
            ? `. ${Math.floor(chainDepth)} match streak${chainCue ? `, ${chainCue}` : ''}`
            : '';
    const rewardForecast =
        chainRewardForecastTexts.length > 0
            ? `. Next rewards: ${chainRewardForecastTexts.slice(0, 2).join(', ')}`
            : '';
    const rewardBurst = rewardBurstText ? `. ${rewardBurstText}` : '';
    const cascade = cascadeText ? `. ${cascadeText}` : '';
    const payoffSummary = payoffSummaryText ? `. ${payoffSummaryText}` : '';
    const crescendo = crescendoText ? `. Crescendo: ${crescendoText}` : '';
    const impactCue = impactCueText ? `. Impact cue: ${impactCueText}` : '';
    const payoffLaneMap = payoffLaneMapText
        ? `. ${enrichPayoffLaneMapLiveText(payoffLaneMapText).replace(/[.!?]+$/u, '')}`
        : '';
    const traitLaneMap = traitLaneMapText
        ? `. ${enrichTraitLaneMapLiveText(traitLaneMapText).replace(/[.!?]+$/u, '')}`
        : '';
    const chainMilestone = chainMilestoneText
        ? `. Chain milestone: ${chainMilestoneText.replace(/[.!?]+$/u, '')}`
        : '';
    return traitInteractionTexts.length > 0
        ? `${headline}${base}${streak}${rewardForecast}${cascade}${rewardBurst}${payoffSummary}${chainMilestone}${crescendo}${impactCue}${payoffLaneMap}${traitLaneMap}. ${traitInteractionTexts.join('. ')}`
        : `${headline}${base}${streak}${rewardForecast}${cascade}${rewardBurst}${payoffSummary}${chainMilestone}${crescendo}${impactCue}${payoffLaneMap}${traitLaneMap}`;
}
