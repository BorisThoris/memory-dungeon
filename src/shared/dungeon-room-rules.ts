import {
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    type RunState
} from './contracts';
import {
    advanceEnemyHazardsOnBoard
} from './dungeon-enemy-hazard-rules';
import {
    revealFirstHiddenDungeonPair,
    scryDungeonCardTiles,
    trapWorkshopTileUpdates
} from './dungeon-room-targeting-rules';
import { addRunDungeonKey } from './dungeon-key-rules';
import { gainRelicFavor } from './relic-favor-rules';
import {
    ROOM_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

export const DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD = 4;
export const DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD = 50;
export const DUNGEON_KEY_CACHE_SCORE_REWARD = 15;
export const DUNGEON_OMEN_ARCHIVE_SCORE_REWARD = 15;

export const revealDungeonRoom = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const tile = run.board.tiles.find((candidate) => candidate.id === tileId);
    if (!tile || tile.pairKey !== ROOM_PAIR_KEY || tile.dungeonCardKind !== 'room') {
        return run;
    }
    const effectId = tile.dungeonCardEffectId;
    const alreadyUsed = tile.dungeonRoomUsed === true;
    let nextRun: RunState = run;
    let markUsed = effectId !== 'room_forge';
    let openedLockedCache = false;
    const scryTileIds = effectId === 'room_scrying_lens' ? scryDungeonCardTiles(run.board.tiles, tileId) : new Set<string>();
    const omenRevealTileIds =
        effectId === 'room_omen_archive' ? revealFirstHiddenDungeonPair(run.board.tiles, tileId) : new Set<string>();
    const trapWorkshopUpdates =
        effectId === 'room_trap_workshop' ? trapWorkshopTileUpdates(run.board.tiles) : { ids: new Set<string>(), resolved: false };
    if (alreadyUsed && effectId !== 'room_forge') {
        markUsed = true;
    } else if (effectId === 'room_campfire') {
        nextRun =
            run.lives < MAX_LIVES
                ? { ...run, lives: Math.min(MAX_LIVES, run.lives + 1) }
                : {
                      ...run,
                      stats: {
                          ...run.stats,
                          totalScore: run.stats.totalScore + 15,
                          currentLevelScore: run.stats.currentLevelScore + 15
                      }
                  };
    } else if (effectId === 'room_fountain') {
        nextRun = {
            ...run,
            stats: { ...run.stats, guardTokens: Math.min(MAX_GUARD_TOKENS, run.stats.guardTokens + 1) }
        };
    } else if (effectId === 'room_map') {
        nextRun = run;
    } else if (effectId === 'room_forge') {
        if (run.shopGold >= 2) {
            nextRun = {
                ...run,
                shopGold: run.shopGold - 2,
                destroyPairCharges: run.destroyPairCharges + 1
            };
        }
        markUsed = false;
    } else if (effectId === 'room_shrine') {
        nextRun =
            run.shopGold > 0
                ? {
                      ...run,
                      shopGold: run.shopGold - 1,
                      stats: {
                          ...run.stats,
                          guardTokens: Math.min(MAX_GUARD_TOKENS, run.stats.guardTokens + 1)
                      }
                  }
                : {
                      ...run,
                      stats: {
                          ...run.stats,
                          totalScore: run.stats.totalScore + 10,
                          currentLevelScore: run.stats.currentLevelScore + 10
                      }
                  };
    } else if (effectId === 'room_scrying_lens') {
        nextRun = run;
    } else if (effectId === 'room_armory') {
        nextRun = {
            ...run,
            destroyPairCharges: run.destroyPairCharges + 1
        };
    } else if (effectId === 'room_key_cache') {
        nextRun = {
            ...run,
            dungeonKeys: addRunDungeonKey(run.dungeonKeys, 'iron', 1),
            stats: {
                ...run.stats,
                totalScore: run.stats.totalScore + DUNGEON_KEY_CACHE_SCORE_REWARD,
                currentLevelScore: run.stats.currentLevelScore + DUNGEON_KEY_CACHE_SCORE_REWARD,
                bestScore: Math.max(run.stats.bestScore, run.stats.totalScore + DUNGEON_KEY_CACHE_SCORE_REWARD)
            }
        };
    } else if (effectId === 'room_trap_workshop') {
        nextRun = {
            ...run,
            dungeonTrapsResolvedThisFloor: trapWorkshopUpdates.resolved
                ? (run.dungeonTrapsResolvedThisFloor ?? 0) + 1
                : run.dungeonTrapsResolvedThisFloor
        };
    } else if (effectId === 'room_omen_archive') {
        const favor = gainRelicFavor(run, 1);
        nextRun = {
            ...run,
            bonusRelicPicksNextOffer: favor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: favor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: favor.relicFavorProgress,
            stats: {
                ...run.stats,
                totalScore: run.stats.totalScore + DUNGEON_OMEN_ARCHIVE_SCORE_REWARD,
                currentLevelScore: run.stats.currentLevelScore + DUNGEON_OMEN_ARCHIVE_SCORE_REWARD,
                bestScore: Math.max(run.stats.bestScore, run.stats.totalScore + DUNGEON_OMEN_ARCHIVE_SCORE_REWARD)
            }
        };
    } else if (effectId === 'room_locked_cache') {
        if ((run.dungeonKeys.iron ?? 0) > 0) {
            openedLockedCache = true;
            nextRun = {
                ...run,
                dungeonKeys: addRunDungeonKey(run.dungeonKeys, 'iron', -1),
                shopGold: run.shopGold + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD,
                stats: {
                    ...run.stats,
                    totalScore: run.stats.totalScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD,
                    currentLevelScore: run.stats.currentLevelScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD
                }
            };
        } else if (run.dungeonMasterKeys > 0) {
            openedLockedCache = true;
            nextRun = {
                ...run,
                dungeonMasterKeys: run.dungeonMasterKeys - 1,
                shopGold: run.shopGold + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD,
                stats: {
                    ...run.stats,
                    totalScore: run.stats.totalScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD,
                    currentLevelScore: run.stats.currentLevelScore + DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD
                }
            };
        }
        markUsed = openedLockedCache;
    }
    const board = nextRun.board ?? run.board;
    const nextBoard = advanceEnemyHazardsOnBoard({
        ...board,
        tiles: board.tiles.map((candidate) => {
            if (candidate.id === tileId) {
                return {
                    ...candidate,
                    state: candidate.state === 'hidden' ? ('flipped' as const) : candidate.state,
                    dungeonCardState: markUsed ? ('resolved' as const) : ('revealed' as const),
                    dungeonRoomUsed: markUsed ? true : candidate.dungeonRoomUsed
                };
            }
            if (effectId === 'room_map' && candidate.state === 'hidden' && isSingletonUtilityPairKey(candidate.pairKey)) {
                return { ...candidate, dungeonCardState: 'revealed' as const };
            }
            if (scryTileIds.has(candidate.id)) {
                return { ...candidate, dungeonCardState: 'revealed' as const };
            }
            if (omenRevealTileIds.has(candidate.id)) {
                return { ...candidate, dungeonCardState: 'revealed' as const };
            }
            if (trapWorkshopUpdates.ids.has(candidate.id)) {
                return {
                    ...candidate,
                    dungeonCardState: trapWorkshopUpdates.resolved ? ('resolved' as const) : ('revealed' as const)
                };
            }
            return candidate;
        })
    });
    return {
        ...nextRun,
        board: nextBoard
    };
};
