export type HudChainRewardHotBadgeModel = {
    ariaLabel: string;
    beatCount: number;
    fill: number;
    label: string;
    screenCue: 'super';
    tone: 'cashout';
};

export type HudChainComboSurgeBandModel = {
    ariaLabel: string;
    beatCount: 4;
    cue: string;
    detail: string;
    label: string;
    screenCue: 'burst';
    tone: 'surge';
    value: string;
};

export type HudChainRewardHotBandModel = {
    ariaLabel: string;
    beatCount: number;
    chaseLabel: string;
    detail: string;
    label: string;
    screenCue: 'super';
    tone: 'cashout';
    value: string;
};

export type HudChainStackedPayoffBadgeModel = {
    action: 'Cash now';
    ariaLabel: string;
    beatCount: number;
    count: number;
    fill: number;
};

export type HudChainAccentFeedbackModel = {
    comboSurgeBand: HudChainComboSurgeBandModel | null;
    nextFirstCue: string;
    nextKeepCue: string;
    nextThenCue: string;
    rewardHotBadge: HudChainRewardHotBadgeModel | null;
    rewardHotBand: HudChainRewardHotBandModel | null;
    stackedPayoffBadge: HudChainStackedPayoffBadgeModel | null;
};

export const buildHudChainAccentFeedbackModel = ({
    buildLabel,
    chainLaneLabel,
    currentStreak,
    forecastCueCount,
    nextChainTargetLabel,
    primaryRewardBeatCount,
    primaryRewardChaseLabel,
    primaryRewardHot,
    primaryRewardLabel,
    primaryRewardProgressFilled,
    primaryRewardProgressRemainingLabel,
    primaryRewardProgressTotal,
    routeCountLabel,
    stackedPayoffLabels,
    traitOpportunityActive,
    traitPrimaryLine
}: {
    buildLabel: string;
    chainLaneLabel: string;
    currentStreak: number;
    forecastCueCount: number;
    nextChainTargetLabel: string;
    primaryRewardBeatCount: number;
    primaryRewardChaseLabel: string | null;
    primaryRewardHot: boolean;
    primaryRewardLabel: string | null;
    primaryRewardProgressFilled: number | null;
    primaryRewardProgressRemainingLabel: string | null;
    primaryRewardProgressTotal: number | null;
    routeCountLabel: string;
    stackedPayoffLabels: string[];
    traitOpportunityActive: boolean;
    traitPrimaryLine: string;
}): HudChainAccentFeedbackModel => {
    const stackedPayoffCount = stackedPayoffLabels.length;
    const nextFirstCue =
        currentStreak >= 10
            ? 'First: protect combo max'
            : currentStreak <= 0
              ? 'First: match any safe match'
              : primaryRewardHot
                ? 'First: cash next match'
                : `First: ${nextChainTargetLabel}`;
    const nextThenCue =
        stackedPayoffCount > 0
            ? 'Then: spend stacked payoff'
            : primaryRewardLabel
              ? `Then: chase ${primaryRewardLabel}`
              : traitOpportunityActive
                ? 'Then: convert route traits'
                : 'Then: keep streak alive';
    const nextKeepCue = `Keep: ${chainLaneLabel.toLowerCase()}`;
    const rewardHotFill =
        primaryRewardProgressFilled != null && primaryRewardProgressTotal != null
            ? Math.round(Math.min(100, (primaryRewardProgressFilled / Math.max(1, primaryRewardProgressTotal)) * 100))
            : 0;
    const rewardHotBadge =
        primaryRewardHot && primaryRewardLabel
            ? {
                  ariaLabel: `Chain reward hot: ${primaryRewardLabel}. ${primaryRewardChaseLabel ?? 'Hit now'}.`,
                  beatCount: primaryRewardBeatCount,
                  fill: rewardHotFill,
                  label: primaryRewardLabel,
                  screenCue: 'super' as const,
                  tone: 'cashout' as const
              }
            : null;
    const rewardHotBand =
        primaryRewardHot && primaryRewardLabel
            ? {
                  ariaLabel: `Chain reward hot band. Reward hot. ${primaryRewardLabel}. ${
                      primaryRewardProgressRemainingLabel ?? primaryRewardChaseLabel ?? 'One match left'
                  }.`,
                  beatCount: primaryRewardBeatCount,
                  chaseLabel: primaryRewardChaseLabel ?? 'Hit now',
                  detail: primaryRewardProgressRemainingLabel ?? primaryRewardChaseLabel ?? 'One match left',
                  label: 'Reward hot',
                  screenCue: 'super' as const,
                  tone: 'cashout' as const,
                  value: primaryRewardLabel
              }
            : null;
    const comboSurgeBand =
        traitOpportunityActive && routeCountLabel !== '1 route' && routeCountLabel !== 'setup'
            ? {
                  ariaLabel: `Chain combo surge band. Combo surge. ${buildLabel}. ${routeCountLabel}. ${traitPrimaryLine}.`,
                  beatCount: 4 as const,
                  cue: traitPrimaryLine,
                  detail: routeCountLabel,
                  label: 'Combo surge',
                  screenCue: 'burst' as const,
                  tone: 'surge' as const,
                  value: buildLabel
              }
            : null;
    const stackedPayoffBadge =
        stackedPayoffCount > 0
            ? {
                  action: 'Cash now' as const,
                  ariaLabel: `Stacked chain payoff: Cash now. ${stackedPayoffCount}x payoff next: ${stackedPayoffLabels.join(' + ')}.`,
                  beatCount: stackedPayoffCount,
                  count: stackedPayoffCount,
                  fill: Math.round(Math.min(100, (stackedPayoffCount / Math.max(1, forecastCueCount)) * 100))
              }
            : null;

    return {
        comboSurgeBand,
        nextFirstCue,
        nextKeepCue,
        nextThenCue,
        rewardHotBadge,
        rewardHotBand,
        stackedPayoffBadge
    };
};

export type HudPickupChainStackCueModel = {
    action: string;
    ariaLabel: string;
    label: string;
    value: string;
};

export const buildHudPickupChainStackCueModel = ({
    primaryRewardHot,
    primaryRewardLabel,
    stackedPayoffCount,
    unclaimedFindableCount
}: {
    primaryRewardHot: boolean;
    primaryRewardLabel: string | null;
    stackedPayoffCount: number;
    unclaimedFindableCount: number;
}): HudPickupChainStackCueModel | null => {
    if (!primaryRewardHot || !primaryRewardLabel || unclaimedFindableCount <= 0) {
        return null;
    }

    const label = stackedPayoffCount > 0 ? 'Pickup super stack' : 'Pickup + Chain';
    const action = stackedPayoffCount > 0 ? 'Cash pickup super stack' : 'Cash pickup stack';
    const value = `${unclaimedFindableCount} pickup${unclaimedFindableCount === 1 ? '' : 's'} + ${primaryRewardLabel}`;

    return {
        action,
        ariaLabel: `Pickup stack cue. ${label}: ${action}. ${value}.`,
        label,
        value
    };
};
