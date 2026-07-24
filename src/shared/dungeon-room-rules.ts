import {
    MAX_GUARD_TOKENS,
    MAX_LIVES,
    type DungeonKeyKind,
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
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';
import {
    ROOM_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

export const DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD = 4;
export const DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD = 50;
export const DUNGEON_KEY_CACHE_SCORE_REWARD = 15;
export const DUNGEON_OMEN_ARCHIVE_SCORE_REWARD = 15;

const gainDungeonRoomScore = (run: RunState, score: number): RunState => {
    const scoreGain = runNonNegativeInteger(score);
    const stats = normalizeSessionStats(run.stats);
    const totalScore = runNonNegativeInteger(stats.totalScore) + scoreGain;
    return {
        ...run,
        stats: {
            ...stats,
            totalScore,
            currentLevelScore: runNonNegativeInteger(stats.currentLevelScore) + scoreGain,
            bestScore: Math.max(runNonNegativeInteger(stats.bestScore), totalScore)
        }
    };
};

export const revealDungeonRoom = (run: RunState, tileId: string): RunState => {
    if (run.status !== 'playing' || !run.board) {
        return run;
    }
    const stats = normalizeSessionStats(run.stats);
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
            runNonNegativeInteger(run.lives) < MAX_LIVES
                ? { ...run, lives: Math.min(MAX_LIVES, runNonNegativeInteger(run.lives) + 1) }
                : gainDungeonRoomScore(run, 15);
    } else if (effectId === 'room_fountain') {
        nextRun = {
            ...run,
            stats: { ...stats, guardTokens: Math.min(MAX_GUARD_TOKENS, runNonNegativeInteger(stats.guardTokens) + 1) }
        };
    } else if (effectId === 'room_map') {
        nextRun = run;
    } else if (effectId === 'room_forge') {
        if (runNonNegativeInteger(run.shopGold) >= 2) {
            nextRun = {
                ...run,
                shopGold: runNonNegativeInteger(run.shopGold) - 2,
                destroyPairCharges: runNonNegativeInteger(run.destroyPairCharges) + 1
            };
        }
        markUsed = false;
    } else if (effectId === 'room_shrine') {
        nextRun =
            runNonNegativeInteger(run.shopGold) > 0
                ? {
                      ...run,
                      shopGold: runNonNegativeInteger(run.shopGold) - 1,
                      stats: {
                          ...stats,
                          guardTokens: Math.min(MAX_GUARD_TOKENS, runNonNegativeInteger(stats.guardTokens) + 1)
                      }
                  }
                : gainDungeonRoomScore(run, 10);
    } else if (effectId === 'room_scrying_lens') {
        nextRun = run;
    } else if (effectId === 'room_armory') {
        nextRun = {
            ...run,
            destroyPairCharges: runNonNegativeInteger(run.destroyPairCharges) + 1
        };
    } else if (effectId === 'room_key_cache') {
        nextRun = {
            ...gainDungeonRoomScore(run, DUNGEON_KEY_CACHE_SCORE_REWARD),
            dungeonKeys: addRunDungeonKey(run.dungeonKeys, 'iron', 1)
        };
    } else if (effectId === 'room_trap_workshop') {
        nextRun = {
            ...run,
            dungeonTrapsResolvedThisFloor: trapWorkshopUpdates.resolved
                ? runNonNegativeInteger(run.dungeonTrapsResolvedThisFloor) + 1
                : runNonNegativeInteger(run.dungeonTrapsResolvedThisFloor)
        };
    } else if (effectId === 'room_omen_archive') {
        const favor = gainRelicFavor(run, 1);
        nextRun = {
            ...gainDungeonRoomScore(run, DUNGEON_OMEN_ARCHIVE_SCORE_REWARD),
            bonusRelicPicksNextOffer: favor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: favor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: favor.relicFavorProgress
        };
    } else if (effectId === 'room_locked_cache') {
        const keyKind: DungeonKeyKind = tile.dungeonKeyKind ?? 'iron';
        if (runNonNegativeInteger(run.dungeonKeys[keyKind]) > 0) {
            openedLockedCache = true;
            nextRun = {
                ...gainDungeonRoomScore(run, DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD),
                dungeonKeys: addRunDungeonKey(run.dungeonKeys, keyKind, -1),
                shopGold: runNonNegativeInteger(run.shopGold) + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD
            };
        } else if (runNonNegativeInteger(run.dungeonMasterKeys) > 0) {
            openedLockedCache = true;
            nextRun = {
                ...gainDungeonRoomScore(run, DUNGEON_LOCKED_ROOM_CACHE_SCORE_REWARD),
                dungeonMasterKeys: decrementRunCounter(run.dungeonMasterKeys),
                shopGold: runNonNegativeInteger(run.shopGold) + DUNGEON_LOCKED_ROOM_CACHE_GOLD_REWARD
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
