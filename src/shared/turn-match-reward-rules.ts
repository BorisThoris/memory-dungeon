import type { RunState } from './contracts';
import { COMBO_SHARD_STREAK_STEP, applyComboShardGain } from './combo-shard-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export interface ResolvedMatchSurvivalRewardInput {
    currentStreak: number;
    findableComboShardGain: number;
    run: RunState;
}

/**
 * What a match banks besides score. Gen 183: the life economy is gone - no guard token every
 * fourth step, no life every eighth, no life for three shards - so this is the shard bank alone,
 * and the shard itself goes in Gen 184.
 */
export interface ResolvedMatchSurvivalReward {
    comboShards: number;
}

export const calculateResolvedMatchSurvivalReward = ({
    currentStreak,
    findableComboShardGain,
    run
}: ResolvedMatchSurvivalRewardInput): ResolvedMatchSurvivalReward => {
    const safeCurrentStreak = runNonNegativeInteger(currentStreak);
    const safeFindableComboShardGain = runNonNegativeInteger(findableComboShardGain);
    const stats = normalizeSessionStats(run.stats);
    const comboShardReward = applyComboShardGain(
        stats.comboShards,
        (safeCurrentStreak > 0 && safeCurrentStreak % COMBO_SHARD_STREAK_STEP === 0 ? 1 : 0) +
            safeFindableComboShardGain
    );
    return { comboShards: comboShardReward.comboShards };
};
