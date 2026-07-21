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
import { normalizeSessionStats } from './session-stats-rules';

const nonNegativeRewardCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

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
    const safeCurrentStreak = nonNegativeRewardCount(currentStreak);
    const safeLives = nonNegativeRewardCount(run.lives);
    const routeGuardTokens = nonNegativeRewardCount(routeCardReward.guardTokens);
    const dungeonGuardTokens = nonNegativeRewardCount(dungeonReward.guardTokens);
    const routeComboShards = nonNegativeRewardCount(routeCardReward.comboShards);
    const dungeonComboShards = nonNegativeRewardCount(dungeonReward.comboShards);
    const safeFindableComboShardGain = nonNegativeRewardCount(findableComboShardGain);
    const stats = normalizeSessionStats(run.stats);
    const guardTokenGain =
        meditation || safeCurrentStreak <= 0 || safeCurrentStreak % COMBO_GUARD_STREAK_STEP !== 0 ? 0 : 1;
    const guardTokensBeforeRewards =
        Math.max(0, stats.guardTokens - (mimicCacheGuardBite ? 1 : 0));
    const guardTokens = Math.min(
        MAX_GUARD_TOKENS,
        guardTokensBeforeRewards + guardTokenGain + routeGuardTokens + dungeonGuardTokens
    );
    const comboShardReward = meditation
        ? applyComboShardGain(
              Math.max(0, stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
              mimicCacheFatalBite ? 0 : Math.max(0, safeLives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0)),
              safeFindableComboShardGain + routeComboShards + dungeonComboShards,
              false
          )
        : applyComboShardGain(
              Math.max(0, stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
              mimicCacheFatalBite ? 0 : Math.max(0, safeLives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0)),
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
