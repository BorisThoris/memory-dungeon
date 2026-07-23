import type { DungeonKeyKind, RouteNodeType, RunState, Tile } from './contracts';
import {
    DUNGEON_BOSS_DEFEAT_SCORE,
    getDungeonBossDefinition
} from './dungeon-boss-rules';
import { getFloorHeldDungeonKeyCount } from './dungeon-key-rules';
import { runNonNegativeInteger } from './run-number-guards';

export const DUNGEON_TRAP_DISARM_SCORE_REWARD = 10;
export const DUNGEON_TRAP_DISARM_GOLD_REWARD = 1;
export const DUNGEON_MIMIC_DISARM_SCORE_REWARD = 20;
export const DUNGEON_MIMIC_DISARM_GOLD_REWARD = 2;
export const DUNGEON_TREASURE_GOLD_REWARD = 2;
export const DUNGEON_TREASURE_SCORE_REWARD = 20;
export const DUNGEON_TREASURE_CACHE_GOLD_REWARD = 3;
export const DUNGEON_TREASURE_CACHE_SCORE_REWARD = 35;
export const DUNGEON_LOCK_SCORE_REWARD = 35;
export const DUNGEON_ENEMY_DEFEAT_SCORE = 30;

export interface DungeonMatchReward {
    score: number;
    shopGold: number;
    guardTokens: number;
    comboShards: number;
    relicFavor: number;
    keysHeldDelta: number;
    masterKeysHeldDelta: number;
    keysSpent: number;
    gatewayRouteType: RouteNodeType | null;
    enemiesDefeated: number;
    treasuresOpened: number;
    gatewaysUsed: number;
}

export const emptyDungeonMatchReward = (): DungeonMatchReward => ({
    score: 0,
    shopGold: 0,
    guardTokens: 0,
    comboShards: 0,
    relicFavor: 0,
    keysHeldDelta: 0,
    masterKeysHeldDelta: 0,
    keysSpent: 0,
    gatewayRouteType: null,
    enemiesDefeated: 0,
    treasuresOpened: 0,
    gatewaysUsed: 0
});

const bossDungeonMatchReward = (bossId: Tile['dungeonBossId']): DungeonMatchReward => {
    const definition = getDungeonBossDefinition(bossId);
    if (definition) {
        return {
            ...emptyDungeonMatchReward(),
            ...definition.reward
        };
    }
    return {
        ...emptyDungeonMatchReward(),
        score: DUNGEON_BOSS_DEFEAT_SCORE,
        relicFavor: 1,
        enemiesDefeated: 1
    };
};

export const getDungeonMatchReward = (run: RunState, first: Tile, second: Tile): DungeonMatchReward => {
    const kind = first.dungeonCardKind ?? second.dungeonCardKind ?? null;
    const effectId = first.dungeonCardEffectId ?? second.dungeonCardEffectId ?? null;
    if (first.dungeonCardState === 'resolved' || second.dungeonCardState === 'resolved') {
        return emptyDungeonMatchReward();
    }
    if (!kind || !effectId) {
        return emptyDungeonMatchReward();
    }
    if (kind === 'gateway') {
        const routeType = first.dungeonRouteType ?? second.dungeonRouteType ?? null;
        return {
            ...emptyDungeonMatchReward(),
            gatewayRouteType: routeType,
            gatewaysUsed: routeType && run.pendingRouteCardPlan == null ? 1 : 0
        };
    }
    if (kind === 'enemy') {
        const bossId = first.dungeonBossId ?? second.dungeonBossId ?? null;
        return bossId
            ? bossDungeonMatchReward(bossId)
            : {
                  ...emptyDungeonMatchReward(),
                  score: DUNGEON_ENEMY_DEFEAT_SCORE,
                  enemiesDefeated: 1
              };
    }
    if (kind === 'treasure') {
        if (effectId === 'treasure_shard') {
            return {
                ...emptyDungeonMatchReward(),
                score: 12,
                shopGold: 1
            };
        }
        if (effectId === 'treasure_cache') {
            return {
                ...emptyDungeonMatchReward(),
                score: DUNGEON_TREASURE_CACHE_SCORE_REWARD,
                shopGold: DUNGEON_TREASURE_CACHE_GOLD_REWARD,
                treasuresOpened: 1
            };
        }
        return {
            ...emptyDungeonMatchReward(),
            score: DUNGEON_TREASURE_SCORE_REWARD,
            shopGold: DUNGEON_TREASURE_GOLD_REWARD,
            treasuresOpened: 1
        };
    }
    if (kind === 'shrine') {
        return { ...emptyDungeonMatchReward(), guardTokens: 1, relicFavor: 1 };
    }
    if (kind === 'key') {
        return { ...emptyDungeonMatchReward(), keysHeldDelta: 1, score: 10 };
    }
    if (kind === 'lever') {
        return { ...emptyDungeonMatchReward(), score: effectId === 'rune_seal' ? 25 : 15 };
    }
    if (kind === 'trap') {
        if (effectId === 'trap_mimic') {
            return {
                ...emptyDungeonMatchReward(),
                score: DUNGEON_MIMIC_DISARM_SCORE_REWARD,
                shopGold: DUNGEON_MIMIC_DISARM_GOLD_REWARD
            };
        }
        return {
            ...emptyDungeonMatchReward(),
            score: DUNGEON_TRAP_DISARM_SCORE_REWARD,
            shopGold: DUNGEON_TRAP_DISARM_GOLD_REWARD
        };
    }
    if (kind === 'lock') {
        const lockKeyKind: DungeonKeyKind = first.dungeonKeyKind ?? second.dungeonKeyKind ?? 'iron';
        const floorHeldKeyCount = getFloorHeldDungeonKeyCount(run.board, lockKeyKind);
        const hasTypedKey = runNonNegativeInteger(run.dungeonKeys[lockKeyKind]) > 0 || floorHeldKeyCount > 0;
        const hasMasterKey = runNonNegativeInteger(run.dungeonMasterKeys) > 0;
        return hasTypedKey || hasMasterKey
            ? {
                  ...emptyDungeonMatchReward(),
                  keysHeldDelta: hasTypedKey ? -1 : 0,
                  masterKeysHeldDelta: hasTypedKey ? 0 : -1,
                  keysSpent: 1,
                  shopGold: 3,
                  score: DUNGEON_LOCK_SCORE_REWARD,
                  treasuresOpened: 1
              }
            : { ...emptyDungeonMatchReward(), score: 5 };
    }
    return emptyDungeonMatchReward();
};
