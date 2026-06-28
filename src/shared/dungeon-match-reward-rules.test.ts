import { describe, expect, it } from 'vitest';

import type { Tile } from './contracts';
import { createNewRun } from './game-core';
import {
    DUNGEON_ENEMY_DEFEAT_SCORE,
    DUNGEON_LOCK_SCORE_REWARD,
    DUNGEON_MIMIC_DISARM_GOLD_REWARD,
    DUNGEON_MIMIC_DISARM_SCORE_REWARD,
    DUNGEON_TREASURE_CACHE_GOLD_REWARD,
    DUNGEON_TREASURE_CACHE_SCORE_REWARD,
    emptyDungeonMatchReward,
    getDungeonMatchReward
} from './dungeon-match-reward-rules';

describe('dungeon match reward rules', () => {
    it('returns no reward for resolved or non-dungeon cards', () => {
        const run = createNewRun(0);

        expect(getDungeonMatchReward(run, tile({ dungeonCardState: 'resolved' }), tile())).toEqual(emptyDungeonMatchReward());
        expect(getDungeonMatchReward(run, tile(), tile())).toEqual(emptyDungeonMatchReward());
    });

    it('rewards gateway, enemy, treasure cache, and mimic trap matches', () => {
        const run = createNewRun(0);

        expect(
            getDungeonMatchReward(run, tile({ dungeonCardKind: 'gateway', dungeonCardEffectId: 'gateway_depth', dungeonRouteType: 'greed' }), tile())
        ).toMatchObject({ gatewayRouteType: 'greed', gatewaysUsed: 1 });
        expect(getDungeonMatchReward(run, tile({ dungeonCardKind: 'enemy', dungeonCardEffectId: 'enemy_sentry' }), tile()))
            .toMatchObject({ score: DUNGEON_ENEMY_DEFEAT_SCORE, enemiesDefeated: 1 });
        expect(getDungeonMatchReward(run, tile({ dungeonCardKind: 'treasure', dungeonCardEffectId: 'treasure_cache' }), tile()))
            .toMatchObject({
                score: DUNGEON_TREASURE_CACHE_SCORE_REWARD,
                shopGold: DUNGEON_TREASURE_CACHE_GOLD_REWARD,
                treasuresOpened: 1
            });
        expect(getDungeonMatchReward(run, tile({ dungeonCardKind: 'trap', dungeonCardEffectId: 'trap_mimic' }), tile()))
            .toMatchObject({
                score: DUNGEON_MIMIC_DISARM_SCORE_REWARD,
                shopGold: DUNGEON_MIMIC_DISARM_GOLD_REWARD
            });
    });

    it('spends a key for locked caches when available', () => {
        const run = { ...createNewRun(0), dungeonKeys: { iron: 1 } };

        expect(getDungeonMatchReward(run, tile({ dungeonCardKind: 'lock', dungeonCardEffectId: 'lock_cache' }), tile()))
            .toMatchObject({
                keysHeldDelta: -1,
                keysSpent: 1,
                score: DUNGEON_LOCK_SCORE_REWARD,
                treasuresOpened: 1
            });
    });

    it('requires the matching key kind for typed locked caches', () => {
        const ironRun = { ...createNewRun(0), dungeonKeys: { iron: 1 } };
        const treasureRun = { ...createNewRun(0), dungeonKeys: { treasure: 1 } };
        const treasureLock = tile({
            dungeonCardKind: 'lock',
            dungeonCardEffectId: 'lock_cache',
            dungeonKeyKind: 'treasure'
        });

        expect(getDungeonMatchReward(ironRun, treasureLock, tile())).toMatchObject({
            keysSpent: 0,
            score: 5
        });
        expect(getDungeonMatchReward(treasureRun, treasureLock, tile())).toMatchObject({
            keysHeldDelta: -1,
            masterKeysHeldDelta: 0,
            keysSpent: 1,
            score: DUNGEON_LOCK_SCORE_REWARD
        });
    });

    it('spends a master key for locked caches only when no matching typed key is available', () => {
        const masterRun = { ...createNewRun(0), dungeonKeys: {}, dungeonMasterKeys: 1 };
        const treasureLock = tile({
            dungeonCardKind: 'lock',
            dungeonCardEffectId: 'lock_cache',
            dungeonKeyKind: 'treasure'
        });

        expect(getDungeonMatchReward(masterRun, treasureLock, tile())).toMatchObject({
            keysHeldDelta: 0,
            masterKeysHeldDelta: -1,
            keysSpent: 1,
            score: DUNGEON_LOCK_SCORE_REWARD
        });
    });
});

const tile = (extra: Partial<Tile> = {}): Tile => ({
    id: 'tile-a',
    pairKey: 'pair-a',
    symbol: 'A',
    label: 'A',
    state: 'hidden',
    ...extra
});
