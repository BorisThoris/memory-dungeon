import {
    CHAIN_HEAL_STREAK_STEP,
    COMBO_GUARD_STREAK_STEP,
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    type RunState
} from './contracts';
import { COMBO_SHARD_STREAK_STEP, applyComboShardGain } from './combo-shard-rules';
import type { DungeonMatchReward } from './dungeon-match-reward-rules';
import type { RouteCardReward } from './route-card-reward-rules';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

export interface ResolvedMatchSurvivalRewardInput {
    catalystAltarUpgraded: boolean;
    currentStreak: number;
    dungeonReward: Pick<DungeonMatchReward, 'comboShards' | 'guardTokens'>;
    findableComboShardGain: number;
    mimicCacheBite: boolean;
    mimicCacheFatalBite: boolean;
    mimicCacheGuardBite: boolean;
    routeCardReward: Pick<RouteCardReward, 'comboShards' | 'guardTokens'>;
    run: RunState;
}

export interface ResolvedMatchSurvivalReward {
    comboShards: number;
    guardTokens: number;
    lives: number;
}

export const calculateResolvedMatchSurvivalReward = ({
    catalystAltarUpgraded,
    currentStreak,
    dungeonReward,
    findableComboShardGain,
    mimicCacheBite,
    mimicCacheFatalBite,
    mimicCacheGuardBite,
    routeCardReward,
    run
}: ResolvedMatchSurvivalRewardInput): ResolvedMatchSurvivalReward => {
    const meditation = run.gameMode === 'meditation';
    const safeCurrentStreak = runNonNegativeInteger(currentStreak);
    const safeLives = runNonNegativeInteger(run.lives);
    const routeGuardTokens = runNonNegativeInteger(routeCardReward.guardTokens);
    const dungeonGuardTokens = runNonNegativeInteger(dungeonReward.guardTokens);
    const routeComboShards = runNonNegativeInteger(routeCardReward.comboShards);
    const dungeonComboShards = runNonNegativeInteger(dungeonReward.comboShards);
    const safeFindableComboShardGain = runNonNegativeInteger(findableComboShardGain);
    const stats = normalizeSessionStats(run.stats);
    const guardTokenGain =
        meditation || safeCurrentStreak <= 0 || safeCurrentStreak % COMBO_GUARD_STREAK_STEP !== 0 ? 0 : 1;
    const guardTokensBeforeRewards = decrementRunCounter(stats.guardTokens, mimicCacheGuardBite ? 1 : 0);
    const comboShardsBeforeRewards = decrementRunCounter(stats.comboShards, catalystAltarUpgraded ? 1 : 0);
    const livesBeforeComboReward = decrementRunCounter(safeLives, mimicCacheBite && !mimicCacheGuardBite ? 1 : 0);
    const guardTokens = Math.min(
        MAX_GUARD_TOKENS,
        guardTokensBeforeRewards + guardTokenGain + routeGuardTokens + dungeonGuardTokens
    );
    const comboShardReward = meditation
        ? applyComboShardGain(
              comboShardsBeforeRewards,
              mimicCacheFatalBite ? 0 : livesBeforeComboReward,
              safeFindableComboShardGain + routeComboShards + dungeonComboShards,
              false
          )
        : applyComboShardGain(
              comboShardsBeforeRewards,
              mimicCacheFatalBite ? 0 : livesBeforeComboReward,
              (safeCurrentStreak > 0 && safeCurrentStreak % COMBO_SHARD_STREAK_STEP === 0 ? 1 : 0) +
                  safeFindableComboShardGain +
                  routeComboShards +
                  dungeonComboShards
          );
    const chainHealLifeGain =
        meditation || safeCurrentStreak <= 0 || safeCurrentStreak % CHAIN_HEAL_STREAK_STEP !== 0 ? 0 : 1;
    const lives = mimicCacheFatalBite
        ? 0
        : Math.min(
              MAX_LIVES,
              safeLives -
                  (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0) +
                  chainHealLifeGain +
                  comboShardReward.lifeGain
          );

    return {
        comboShards: comboShardReward.comboShards,
        guardTokens,
        lives
    };
};
