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
    const guardTokenGain =
        meditation || currentStreak % COMBO_GUARD_STREAK_STEP !== 0 ? 0 : 1;
    const guardTokensBeforeRewards = Math.max(0, run.stats.guardTokens - (mimicCacheGuardBite ? 1 : 0));
    const guardTokens = Math.min(
        MAX_GUARD_TOKENS,
        guardTokensBeforeRewards + guardTokenGain + routeCardReward.guardTokens + dungeonReward.guardTokens
    );
    const comboShardReward = meditation
        ? applyComboShardGain(
              Math.max(0, run.stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
              mimicCacheFatalBite ? 0 : run.lives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0),
              findableComboShardGain + routeCardReward.comboShards + dungeonReward.comboShards,
              false
          )
        : applyComboShardGain(
              Math.max(0, run.stats.comboShards - (catalystAltarUpgraded ? 1 : 0)),
              mimicCacheFatalBite ? 0 : run.lives - (mimicCacheBite && !mimicCacheGuardBite ? 1 : 0),
              (currentStreak % COMBO_SHARD_STREAK_STEP === 0 ? 1 : 0) +
                  findableComboShardGain +
                  routeCardReward.comboShards +
                  dungeonReward.comboShards
          );
    const chainHealLifeGain =
        meditation || currentStreak % CHAIN_HEAL_STREAK_STEP !== 0 ? 0 : 1;
    const lives = mimicCacheFatalBite
        ? 0
        : Math.min(
              MAX_LIVES,
              run.lives -
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
