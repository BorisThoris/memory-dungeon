/**
 * Match-score floater live region (`aria-live`). Centralized for a11y review and future i18n.
 */
import { getChainMomentumCue } from './chainMomentum';

export const matchScoreFloaterChainCue = getChainMomentumCue;

const PAYOFF_LANE_LIVE_ACTION_ROWS = [
    { lane: 'Route', action: 'Cash route' },
    { lane: 'Pickup', action: 'Claim pickup' },
    { lane: 'Trait', action: 'Cash trait' },
    { lane: 'Chain', action: 'Cash chain' }
] as const;

const TRAIT_LANE_LIVE_ACTION_ROWS = [
    { lane: 'Block', action: 'Deny match' },
    { lane: 'Guard', action: 'Protect run' },
    { lane: 'Recall', action: 'Set memory' },
    { lane: 'Risk', action: 'Watch hazard' },
    { lane: 'Score', action: 'Cash score' },
    { lane: 'Shard', action: 'Cash shard' },
    { lane: 'Tool', action: 'Use tool' }
] as const;

const enrichPayoffLaneMapLiveText = (text: string): string =>
    PAYOFF_LANE_LIVE_ACTION_ROWS.reduce((current, { lane, action }) => {
        const lanePattern = new RegExp(`(${lane}:\\s+\\d+\\.\\s+)(?!${action.replace(/\s+/gu, '\\s+')}\\.)`, 'gu');
        return current.replace(lanePattern, `$1${action}. `);
    }, text);

const enrichTraitLaneMapLiveText = (text: string): string =>
    TRAIT_LANE_LIVE_ACTION_ROWS.reduce((current, { lane, action }) => {
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
