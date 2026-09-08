import {
    CHAIN_HEAL_STREAK_STEP,
    COMBO_GUARD_STREAK_STEP,
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    type RunState
} from './contracts';
import { COMBO_SHARD_STREAK_STEP, applyComboShardGain } from './combo-shard-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export interface ResolvedMatchSurvivalRewardInput {
    currentStreak: number;
    findableComboShardGain: number;
    run: RunState;
}

export interface ResolvedMatchSurvivalReward {
    comboShards: number;
    guardTokens: number;
    lives: number;
}

export const calculateResolvedMatchSurvivalReward = ({
    currentStreak,
    findableComboShardGain,
    run
}: ResolvedMatchSurvivalRewardInput): ResolvedMatchSurvivalReward => {
    const safeCurrentStreak = runNonNegativeInteger(currentStreak);
    const safeLives = runNonNegativeInteger(run.lives);
    const safeFindableComboShardGain = runNonNegativeInteger(findableComboShardGain);
    const stats = normalizeSessionStats(run.stats);
    const guardTokenGain =
        safeCurrentStreak <= 0 || safeCurrentStreak % COMBO_GUARD_STREAK_STEP !== 0 ? 0 : 1;
    const guardTokens = Math.min(MAX_GUARD_TOKENS, stats.guardTokens + guardTokenGain);
    const comboShardReward = applyComboShardGain(
        stats.comboShards,
        safeLives,
        (safeCurrentStreak > 0 && safeCurrentStreak % COMBO_SHARD_STREAK_STEP === 0 ? 1 : 0) +
            safeFindableComboShardGain
    );
    const chainHealLifeGain =
        safeCurrentStreak <= 0 || safeCurrentStreak % CHAIN_HEAL_STREAK_STEP !== 0 ? 0 : 1;
    const lives = Math.min(MAX_LIVES, safeLives + chainHealLifeGain + comboShardReward.lifeGain);

    return {
        comboShards: comboShardReward.comboShards,
        guardTokens,
        lives
    };
};
