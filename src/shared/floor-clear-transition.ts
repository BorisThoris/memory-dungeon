import {
    GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS,
    MAX_LIVES,
    type BoardState,
    type LevelResult,
    type RunState
} from './contracts';
import { getDungeonLevelResultTags } from './secondary-objectives';
import { generateRouteChoices } from './route-choice-rules';
import { gainRelicFavor } from './relic-favor-rules';
import { clearCurrentDungeonNode, revealDungeonChoices } from './run-map';
import { getRunDungeonMapState } from './dungeon-run-state-rules';
import { getDungeonBossTrophyCacheResult } from './dungeon-boss-clear-rules';
import { calculateRating } from './scoring-rules';
import {
    applyMomentumBonusShards,
    EXTREME_FEVER_BONUS_TAG,
    getFloorClearMomentumBonus
} from './floor-clear-momentum-bonus-rules';
import {
    applyFloorClearEnemyHazardDefeats,
    calculateFloorClearScore,
    createFloorClearLevelResult,
    getClearLifeReason
} from './level-clear-rules';
import { getFloorClearObjectiveResult } from './secondary-objective-rules';
import { clearResolveState, extendTimerTimestampMs } from './run-timer-rules';
import { getShopGoldRewardForFloor } from './shop-rules';
import { hasMutator } from './mutators';
import { getParasiteFloorsAfterFeaturedObjectiveClear } from './score-parasite-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';
import { getChainTier } from './chain-tier-rules';
import type { GameplayCommand, GameplayEvent } from './gameplay-core-contracts';

export interface FloorClearExecutionContext {
    commandId: string;
    events: GameplayEvent[];
}

export interface FloorClearSlayerInput {
    bossTrophyClaimed: boolean;
    riskWagerOutcome: 'won' | 'lost' | undefined;
    featuredObjectiveCompleted: boolean;
    scoreParasiteActive: boolean;
}

export interface FloorClearSlayerResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    bossTrophyScoreGain: number;
    riskWagerFavorGain: number;
    riskWagerStreakFloor: number;
    parasiteRelief: number;
}

export interface FloorClearTransitionDependencies {
    resolveSlayerFloorClear: (
        run: RunState,
        input: FloorClearSlayerInput,
        commandIdPrefix: string,
        execution?: FloorClearExecutionContext
    ) => FloorClearSlayerResult;
    appendGameplayJournal: (
        run: RunState,
        commands: readonly GameplayCommand[],
        events: readonly GameplayEvent[]
    ) => RunState;
}

export const createFinalizeLevelTransition = ({
    resolveSlayerFloorClear: resolveSlayerFloorClearThroughGameplayCore,
    appendGameplayJournal
}: FloorClearTransitionDependencies) => {
    const finalizeLevel = (run: RunState, board: BoardState, execution?: FloorClearExecutionContext): RunState => {
        const floorClearHazards = applyFloorClearEnemyHazardDefeats(run, board);
        run = floorClearHazards.run;
        board = floorClearHazards.board;
        const stats = normalizeSessionStats(run.stats);
        const tries = runNonNegativeInteger(stats.tries);
        const livesBeforeClear = runNonNegativeInteger(run.lives);
        const currentLevelScoreBeforeClear = runNonNegativeInteger(stats.currentLevelScore);
        const totalScoreBeforeClear = runNonNegativeInteger(stats.totalScore);
        const perfect = tries === 0;
        const clearLifeReason = getClearLifeReason(tries);
        const clearLifeGained = clearLifeReason !== 'none' && livesBeforeClear < MAX_LIVES ? 1 : 0;
        const legacyFloorClearObjective = getFloorClearObjectiveResult(run, board);
        const legacyBossTrophyCache = getDungeonBossTrophyCacheResult(run, board);
        const slayerFloorClear = resolveSlayerFloorClearThroughGameplayCore(
            run,
            {
                bossTrophyClaimed: legacyBossTrophyCache.outcome === 'claimed',
                riskWagerOutcome: legacyFloorClearObjective.featuredObjectiveClear.endlessRiskWagerOutcome,
                featuredObjectiveCompleted: legacyFloorClearObjective.featuredObjectiveCompleted,
                scoreParasiteActive: hasMutator(run, 'score_parasite')
            },
            `floor-clear:${run.runSeed}:${board.level}`,
            execution
        );
        const floorClearObjective = getFloorClearObjectiveResult(run, board, {
            wagerSuretyFavorBonus: slayerFloorClear.riskWagerFavorGain,
            wagerSuretyLossStreakFloor: slayerFloorClear.riskWagerStreakFloor
        });
        const bonusTags: string[] = [...floorClearObjective.bonusTags];
        if (run.traitRouteObjectiveCompletedThisFloor) {
            bonusTags.push('trait_route_objective');
        }
        const objectiveBonus = floorClearObjective.objectiveBonus;
        const featuredObjectiveId = floorClearObjective.featuredObjectiveId;
        const featuredObjectiveCompleted = floorClearObjective.featuredObjectiveCompleted;
        const featuredObjectiveClear = floorClearObjective.featuredObjectiveClear;
        const bossTrophyCache = getDungeonBossTrophyCacheResult(run, board, {
            chapterCompassScoreBonus: slayerFloorClear.bossTrophyScoreGain
        });
    
        const clearScore = calculateFloorClearScore({
            bossTrophyCacheScore: bossTrophyCache.score,
            currentLevelScore: currentLevelScoreBeforeClear,
            featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
            floorTag: board.floorTag,
            level: board.level,
            objectiveBonus,
            perfect
        });
        const scoreGained = clearScore.scoreGained;
        if (board.floorTag === 'boss') {
            bonusTags.push('boss_floor');
            bonusTags.push(bossTrophyCache.outcome === 'claimed' ? 'boss_trophy_cache' : 'boss_trophy_forfeited');
        }
        bonusTags.push(...getDungeonLevelResultTags(run, board, perfect));
        const bankedScoreBeforeClear = Math.max(0, totalScoreBeforeClear - currentLevelScoreBeforeClear);
        const totalScore = bankedScoreBeforeClear + scoreGained;
        const bestScore = Math.max(runNonNegativeInteger(stats.bestScore), totalScore);
        const rating = calculateRating(tries);
        const lives = Math.min(MAX_LIVES, livesBeforeClear + clearLifeGained);
        // Extreme Fever: the momentum still standing when the last pair went pays gold, and a
        // shard at Fever. Read before the streak resets with the floor, never from the score.
        const momentumBonus = getFloorClearMomentumBonus({
            chain: stats.currentStreak,
            cascadedPairs: run.chunkPairsThisChain,
            pairsOnFloor: board.pairCount
        });
        if (momentumBonus.tier === 'fever') {
            bonusTags.push(EXTREME_FEVER_BONUS_TAG);
        }
        // The floor's chain record: the deepest rung its longest chain reached, against this
        // floor's ladder. The run counts floors, not breaks, so a quest can ask for three floors.
        const floorChainTier = getChainTier(runNonNegativeInteger(run.bestChainThisFloor), board.pairCount);
        const totalRelicFavorGained =
            featuredObjectiveClear.relicFavorGained + featuredObjectiveClear.endlessRiskWagerFavorGained;
        const relicFavor = gainRelicFavor(run, totalRelicFavorGained);
        const routeChoices: LevelResult['routeChoices'] =
            run.gameMode === 'endless' && board.level > 0 ? generateRouteChoices(run, board.level + 1) : undefined;
        const currentDungeonRun = getRunDungeonMapState(run);
        const dungeonRun = routeChoices
            ? revealDungeonChoices(currentDungeonRun, board.level, routeChoices)
            : clearCurrentDungeonNode(currentDungeonRun, board.level);
        const parasiteFloors =
            featuredObjectiveId != null
                ? getParasiteFloorsAfterFeaturedObjectiveClear(run, featuredObjectiveCompleted, {
                      reliefAmount: slayerFloorClear.parasiteRelief
                  })
                : run.parasiteFloors;
        const lastLevelResult = createFloorClearLevelResult({
            bossTrophyCacheOutcome: bossTrophyCache.outcome,
            bossTrophyCacheScore: bossTrophyCache.score,
            bonusTags,
            clearLifeGained,
            clearLifeReason,
            endlessRiskWagerFavorGained: featuredObjectiveClear.endlessRiskWagerFavorGained,
            endlessRiskWagerOutcome: featuredObjectiveClear.endlessRiskWagerOutcome,
            endlessRiskWagerStreakLost: featuredObjectiveClear.endlessRiskWagerStreakLost,
            featuredObjectiveCompleted,
            featuredObjectiveId,
            featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
            featuredObjectiveStreakBonus: featuredObjectiveClear.featuredObjectiveStreakBonus,
            level: board.level,
            livesRemaining: lives,
            mistakes: tries,
            momentumBonus,
            objectiveBonusScore: objectiveBonus,
            perfect,
            rating,
            relicFavorGained: totalRelicFavorGained,
            routeChoices,
            run,
            scoreGained,
            traitRouteObjectiveCompleted: run.traitRouteObjectiveCompletedThisFloor,
            traitRouteObjectiveProgress: run.traitRouteObjectiveProgressThisFloor,
            traitRouteObjectiveRequired: run.traitRouteObjectiveRequiredThisFloor,
            traitRouteObjectiveReward: run.traitRouteObjectiveRewardTextThisFloor ?? undefined
        });
    
        const journaledRun = execution
            ? run
            : appendGameplayJournal(run, slayerFloorClear.commands, slayerFloorClear.events);
        return {
            ...journaledRun,
            status: 'levelComplete',
            lives,
            bonusRelicPicksNextOffer: relicFavor.bonusRelicPicksNextOffer,
            favorBonusRelicPicksNextOffer: relicFavor.favorBonusRelicPicksNextOffer,
            relicFavorProgress: relicFavor.relicFavorProgress,
            shopGold: runNonNegativeInteger(run.shopGold) + getShopGoldRewardForFloor(board.level) + momentumBonus.gold,
            shopOffers: run.shopOffers,
            parasiteFloors,
            featuredObjectiveStreak: featuredObjectiveClear.featuredObjectiveStreak,
            endlessRiskWager: featuredObjectiveClear.activeEndlessRiskWager ? null : run.endlessRiskWager,
            gauntletDeadlineMs:
                run.gameMode === 'gauntlet' && run.gauntletDeadlineMs !== null
                    ? extendTimerTimestampMs(run.gauntletDeadlineMs, GAUNTLET_FLOOR_CLEAR_TIME_BONUS_MS)
                    : run.gauntletDeadlineMs,
            board,
            pinnedTileIds: [],
            peekRevealedTileIds: [],
            flashPairRevealedTileIds: [],
            stickyBlockIndex: null,
            dungeonRun,
            sharpFloorsThisRun:
                runNonNegativeInteger(run.sharpFloorsThisRun) +
                (floorChainTier === 'sharp' || floorChainTier === 'fever' ? 1 : 0),
            feverFloorsThisRun: runNonNegativeInteger(run.feverFloorsThisRun) + (floorChainTier === 'fever' ? 1 : 0),
            stats: {
                ...stats,
                comboShards: applyMomentumBonusShards(stats.comboShards, momentumBonus),
                totalScore,
                bestScore,
                currentLevelScore: scoreGained,
                rating,
                levelsCleared: runNonNegativeInteger(stats.levelsCleared) + 1,
                highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), board.level),
                perfectClears: perfect
                    ? runNonNegativeInteger(stats.perfectClears) + 1
                    : runNonNegativeInteger(stats.perfectClears)
            },
            timerState: clearResolveState(run),
            lastLevelResult
        };
    };
    return finalizeLevel;
};
