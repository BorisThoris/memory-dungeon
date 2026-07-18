/** Single source for match-score floater animation / dismiss timing (ms). */
export const MATCH_SCORE_FLOAT_MS_FULL = 780;
export const MATCH_SCORE_FLOAT_MS_REDUCED = 500;

/** Extra cushion if `animationend` never fires (devtools, odd engines). */
export const MATCH_SCORE_FLOAT_FALLBACK_MARGIN_MS = 120;

type MatchScoreFloatTimingProfile = {
    chainMilestone?: unknown;
    crescendo?: { tier: 'score' | 'prime' | 'cashout' | 'stack' | 'super' } | null;
    kind?: 'match' | 'miss';
    payoffLaneMap?: readonly unknown[] | null;
    rewardBurst?: unknown;
};

export function matchScoreFloatDurationMs(
    reducedMotion: boolean,
    profile?: MatchScoreFloatTimingProfile | null
): number {
    const base = reducedMotion ? MATCH_SCORE_FLOAT_MS_REDUCED : MATCH_SCORE_FLOAT_MS_FULL;
    if (!profile || profile.kind === 'miss') {
        return base;
    }

    const tier = profile.crescendo?.tier ?? 'score';
    const tierBonus =
        tier === 'super'
            ? 620
            : tier === 'stack'
              ? 460
              : tier === 'cashout'
                ? 300
                : tier === 'prime'
                  ? 150
                  : 0;
    const laneBonus = Math.min(profile.payoffLaneMap?.length ?? 0, 4) * 70;
    const milestoneBonus = profile.chainMilestone ? 120 : 0;
    const rewardBonus = profile.rewardBurst ? 120 : 0;
    const motionScale = reducedMotion ? 0.62 : 1;

    return Math.round(base + (tierBonus + laneBonus + milestoneBonus + rewardBonus) * motionScale);
}
