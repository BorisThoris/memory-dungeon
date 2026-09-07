import {
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    RECALL_FOCUS_MAX,
    type BoardState,
    type FindableKind,
    type RunState
} from './contracts';
import { clearFinalPairEnemyHazardOccupationForRun } from './enemy-hazard-board-rules';
import { isBoardComplete } from './board-inspection';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { tilesArePairMatch } from './scoring-rules';
import { clearResolveState } from './run-timer-rules';
import { rotateAnchorSealPressure } from './shifting-spotlight-rules';
import { deriveMatchClaimContext } from './match-claim-rules';
import { selectGambitMatchedPair } from './gambit-match-rules';
import { resolveMismatchTurnTransition } from './turn-mismatch-rules';
import { calculateResolvedMatchSurvivalReward } from './turn-match-reward-rules';
import { resolveTurnMatchFollowup } from './turn-match-followup-rules';
import { resolveTurnMatchBoardCleanup } from './turn-match-board-cleanup-rules';
import { resolveTurnMatchEconomy } from './turn-match-economy-rules';
import { resolveTurnMatchProgress } from './turn-match-progress-rules';
import { resolveTurnMatchBoardResolution } from './turn-match-board-resolution-rules';
import { resolveTurnMatchScoringSummary } from './turn-match-scoring-summary-rules';
import { resolveTileTraitEffects } from './tile-trait-rules';
import { appendGameplayJournal } from './gameplay-journal';
import type { GameplayCommand, GameplayEvent } from './gameplay-core-contracts';
import { addTileTraitCountStats, normalizeSessionStats } from './session-stats-rules';
import { runFilteredStringArrayOrNull, runStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import { gainRelicFavor } from './relic-favor-rules';
import type { TileTraitInteractionTag } from './tile-trait-rules';
import { applyTraitRouteObjectiveProgress } from './trait-route-objectives';

const GAMBIT_FAIL_EXTRA_TRIES = 1;

export interface BoardTurnFindableRewardResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    comboShardGain: number;
    safeHazardWardGain: number;
    scoreGain: number;
    scoutRevealGain: number;
    migrated: boolean;
}

export interface BoardTurnWildMatchResult {
    run: RunState;
    commands: GameplayCommand[];
    events: GameplayEvent[];
}

export interface BoardTurnTransitionDependencies {
    finalizeLevel: (
        run: RunState,
        board: BoardState,
        execution?: BoardTurnExecutionContext
    ) => RunState;
    resolveFindableMatchReward: (
        run: RunState,
        findableKind: FindableKind | null,
        commandId: string,
        execution?: BoardTurnExecutionContext
    ) => BoardTurnFindableRewardResult;
    consumeWildMatch: (
        run: RunState,
        wildTileId: string,
        pairedTileId: string,
        commandId: string,
        execution?: BoardTurnExecutionContext
    ) => BoardTurnWildMatchResult;
}

export interface BoardTurnExecutionContext {
    commandId: string;
    events: GameplayEvent[];
    /**
     * Collects the trait interaction tags produced while resolving the turn. The
     * transition returns only a RunState, and the tags are not persisted on it, so
     * without this the board.turn_resolved event could not report which synergies
     * actually fired - and the build-strategy simulation asserts on exactly that.
     */
    traitInteractionTags?: TileTraitInteractionTag[];
}

const flippedTileIdsForRun = (run: RunState): string[] | null =>
    runFilteredStringArrayOrNull(run.board?.flippedTileIds);

export const createResolveBoardTurnTransition = ({
    finalizeLevel,
    resolveFindableMatchReward: resolveFindableMatchRewardThroughGameplayCore,
    consumeWildMatch: consumeWildMatchThroughGameplayCore
}: BoardTurnTransitionDependencies) => {
    const resolveGambitThree = (
        run: RunState,
        encorePairKeys: string[],
        execution?: BoardTurnExecutionContext
    ): RunState => {
        const flippedTileIds = flippedTileIdsForRun(run);
        if (!run.board || !flippedTileIds || flippedTileIds.length !== 3) {
            return run;
        }
        const [aId, bId, cId] = flippedTileIds;
        const ta = run.board.tiles.find((t) => t.id === aId);
        const tb = run.board.tiles.find((t) => t.id === bId);
        const tc = run.board.tiles.find((t) => t.id === cId);
        if (!ta || !tb || !tc) {
            return run;
        }
        const selection = selectGambitMatchedPair(run.board);
    
        if (selection) {
            const { firstTileId: matchA, secondTileId: matchB, thirdTileId: thirdId } = selection;
            const tileMatchA = run.board.tiles.find((t) => t.id === matchA);
            const tileMatchB = run.board.tiles.find((t) => t.id === matchB);
            if (!tileMatchA || !tileMatchB) {
                return run;
            }
            const matchClaimContext = deriveMatchClaimContext({
                firstTile: tileMatchA,
                firstTileId: matchA,
                run,
                secondTile: tileMatchB,
                secondTileId: matchB
            });
            const {
                anchorSealClaimed,
                catalystAltarUpgraded,
                dungeonReward,
                dungeonTrapResolvedDelta,
                claimedFindableKind,
                findableComboShardGain,
                findableSafeHazardWardGain,
                findableScoreBonus,
                findablesClaimedDelta,
                loadedGatewayClaimed,
                matchedDungeonKeyKind,
                matchedDungeonKind,
                matchedPairKey,
                mimicCacheBite,
                mimicCacheClaimed,
                mimicCacheFatalBite,
                mimicCacheGuardBite,
                parasiteVesselConverted,
                pinLatticeRewarded,
                routeCardReward,
                usedWild
            } = matchClaimContext;
            const findableReward = resolveFindableMatchRewardThroughGameplayCore(
                run,
            claimedFindableKind,
            `findable-match:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:${matchedPairKey}:gambit`,
            execution
            );
            const resolvedFindableComboShardGain = findableReward.migrated
                ? findableReward.comboShardGain
                : findableComboShardGain;
            const resolvedFindableSafeHazardWardGain = findableReward.migrated
                ? findableReward.safeHazardWardGain
                : findableSafeHazardWardGain;
            const resolvedFindableScoreBonus = findableReward.migrated
                ? findableReward.scoreGain
                : findableScoreBonus;
            const resolvedFindableScoutGain = findableReward.migrated
                ? findableReward.scoutRevealGain
                : claimedFindableKind === 'scout_glint' ? 1 : 0;
    
            const resolution = resolveTurnMatchBoardResolution({
                run,
                board: run.board,
                context: matchClaimContext,
                firstTile: tileMatchA,
                secondTile: tileMatchB,
                findableScoutGain: resolvedFindableScoutGain,
                firstTileId: matchA,
                secondTileId: matchB,
                thirdTileId: thirdId
            });
            const {
                board,
                findableScout,
                cascadeHazard,
                chunkBreak,
                fragileCacheClaimed,
                tollCacheClaimed,
                fuseCacheClaimed,
                fuseCacheFresh,
                enemyDamage,
                hazardDamage,
                lastPairHazardClear,
                lanternScout,
                omenScout
            } = resolution;
            /*
             * A findable that went with the chunk is paid the way a matched findable is paid, through
             * the same adapter with its own command id, so its score and shards land in the same sums.
             */
            const chunkFindable = chunkBreak.claimedFindableKind
                ? resolveFindableMatchRewardThroughGameplayCore(
                      run,
                      chunkBreak.claimedFindableKind,
                      `findable-chunk:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:${matchedPairKey}`,
                      execution
                  )
                : { scoreGain: 0, comboShardGain: 0, safeHazardWardGain: 0, scoutRevealGain: 0, migrated: false, commands: [], events: [] };
            const traitReward = resolveTileTraitEffects({
                run,
                board: run.board,
            sourceTiles: [tileMatchA, tileMatchB],
            source: 'match',
            gameplayEffectContext: execution
            });
            const scoring = resolveTurnMatchScoringSummary({
                run,
                sourceBoard: run.board,
                resolvedBoard: board,
                matchedPairKey,
                matchedTiles: [tileMatchA, tileMatchB],
                encorePairKeys,
                findableScoreBonus: resolvedFindableScoreBonus + traitReward.scoreBonus,
                chunkScore: chunkBreak.score + chunkFindable.scoreGain,
                routeCardScore: routeCardReward.score,
                dungeonScore: dungeonReward.score,
                enemyDamageScore: enemyDamage.score,
                hazardDamageScore: hazardDamage.score,
                fragileCacheClaimed,
                fuseCacheFresh,
                pinLatticeRewarded,
                tollCacheClaimed
            });
            const survivalReward = calculateResolvedMatchSurvivalReward({
                catalystAltarUpgraded,
                currentStreak: scoring.currentStreak,
                dungeonReward,
                findableComboShardGain: resolvedFindableComboShardGain + traitReward.comboShardGain + chunkBreak.comboShardGain + chunkFindable.comboShardGain,
                mimicCacheBite,
                mimicCacheFatalBite,
                mimicCacheGuardBite,
                routeCardReward,
                run
            });
            execution?.traitInteractionTags?.push(...traitReward.interactionTags);
            const traitRouteObjective = applyTraitRouteObjectiveProgress(run, traitReward.interactionTags);
            const lives = survivalReward.lives;
            const routeFavor = gainRelicFavor(run, routeCardReward.relicFavor + dungeonReward.relicFavor + traitReward.relicFavorGain);
            const wildMatch = usedWild && runNonNegativeInteger(run.wildMatchesRemaining) > 0
                ? consumeWildMatchThroughGameplayCore(
                      run,
                      tileMatchA.pairKey === WILD_PAIR_KEY ? tileMatchA.id : tileMatchB.id,
                  tileMatchA.pairKey === WILD_PAIR_KEY ? tileMatchB.id : tileMatchA.id,
                  `wild-match:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:gambit`,
                  execution
                  )
                : { run, commands: [], events: [] };
    
            const spunG = rotateAnchorSealPressure(run, board);
            const followup = resolveTurnMatchFollowup({
                run,
                matchedPairKey,
                encoreKey: scoring.encoreKey,
                loadedGatewayClaimed,
                dungeonGatewayRouteType: dungeonReward.gatewayRouteType
            });
            const boardCleanup = resolveTurnMatchBoardCleanup({
                run,
                board: run.board,
                matchedTileIds: [matchA, matchB],
                firstMatchedTileId: matchA,
                recallBonus: scoring.recallBonus
            });
            const economy = resolveTurnMatchEconomy({
                run,
                routeCardShopGold: routeCardReward.shopGold,
                dungeonShopGold: dungeonReward.shopGold + chunkBreak.treasureGold,
                dungeonKeysDelta: dungeonReward.keysHeldDelta,
                dungeonMasterKeysDelta: dungeonReward.masterKeysHeldDelta,
                tollCacheClaimed,
                fuseCacheClaimed,
                fuseCacheFresh,
                matchedDungeonKind,
                matchedDungeonKeyKind
            });
            const defeatedDungeonEnemies =
                dungeonReward.enemiesDefeated +
                enemyDamage.defeated +
                hazardDamage.bossDefeated +
                lastPairHazardClear.bossesDefeated;
            const defeatedEnemyHazards = hazardDamage.defeated + lastPairHazardClear.defeated;
            const progress = resolveTurnMatchProgress({
                run,
                cursedMatchedEarly: scoring.cursedMatchedEarly,
                findablesClaimedDelta: findablesClaimedDelta + (chunkBreak.claimedFindableKind ? 1 : 0),
                routeCardSafeHazardWardCharges: routeCardReward.safeHazardWardCharges,
                findableSafeHazardWardGain: resolvedFindableSafeHazardWardGain,
                cascadeHazardTriggered: cascadeHazard.triggered,
                chunkPairsBroken: chunkBreak.brokenPairKeys.length,
                chunkScore: chunkBreak.score + chunkFindable.scoreGain,
                chunkTier: chunkBreak.tier,
                chainAfter: scoring.currentStreak,
                chunkWardensDefeated: chunkBreak.enemiesDefeated,
                chunkDroppedPairs: chunkBreak.droppedPairKeys.length,
                chunkMomentumPairs: chunkBreak.brokenPairKeys.length,
                chunkRippleWaves: chunkBreak.waves,
                fragileCacheClaimed,
                tollCacheClaimed,
                fuseCacheClaimed,
                fuseCacheFresh,
                lanternScouted: lanternScout.scouted,
                findableScouted: findableScout.scouted,
                omenScouted: omenScout.scouted,
                mimicCacheClaimed,
                mimicCacheBite,
                mimicCacheGuardBite,
                anchorSealUsed: spunG.anchorSealUsed,
                anchorSealClaimed,
                loadedGatewayClaimed,
                catalystAltarUpgraded,
                parasiteVesselConverted,
                pinLatticeRewarded,
                defeatedDungeonEnemies,
                defeatedEnemyHazards,
                openedDungeonTreasures: dungeonReward.treasuresOpened + chunkBreak.treasuresSpilled,
                resolvedDungeonTraps: dungeonTrapResolvedDelta,
                usedDungeonGateways: dungeonReward.gatewaysUsed
            });
            const stats = normalizeSessionStats(run.stats);
    
        const journaledRun = execution
            ? wildMatch.run
            : appendGameplayJournal(
                  wildMatch.run,
                  [...wildMatch.commands, ...findableReward.commands, ...(traitReward.gameplayCommands ?? [])],
                  [...wildMatch.events, ...findableReward.events, ...(traitReward.gameplayEvents ?? [])]
              );
            const nextRun: RunState = {
                ...journaledRun,
                gambitThirdFlipUsed: true,
                gambitAvailableThisFloor: false,
                powersUsedThisRun: true,
                status: mimicCacheFatalBite ? 'gameOver' : 'playing',
                lives,
                board: spunG.board,
                shiftingSpotlightNonce: spunG.shiftingSpotlightNonce,
                wildMatchesRemaining: runNonNegativeInteger(journaledRun.wildMatchesRemaining),
                peekCharges: runNonNegativeInteger(run.peekCharges) + runNonNegativeInteger(traitReward.peekChargeGain),
                shuffleCharges: runNonNegativeInteger(run.shuffleCharges) + runNonNegativeInteger(traitReward.shuffleChargeGain),
                regionShuffleCharges:
                    runNonNegativeInteger(run.regionShuffleCharges) + runNonNegativeInteger(traitReward.regionShuffleChargeGain),
                flashPairCharges: runNonNegativeInteger(run.flashPairCharges) + runNonNegativeInteger(traitReward.flashPairChargeGain),
                shopGold: runNonNegativeInteger(economy.shopGold) + runNonNegativeInteger(traitReward.shopGoldGain),
                dungeonKeys: economy.dungeonKeys,
                dungeonMasterKeys: economy.dungeonMasterKeys,
                bonusRelicPicksNextOffer: routeFavor.bonusRelicPicksNextOffer,
                favorBonusRelicPicksNextOffer: routeFavor.favorBonusRelicPicksNextOffer,
                relicFavorProgress: routeFavor.relicFavorProgress,
                nBackMatchCounter: followup.nBackMatchCounter,
                nBackAnchorPairKey: followup.nBackAnchorPairKey,
                matchedPairKeysThisRun: [...runStringArray(run.matchedPairKeysThisRun), scoring.encoreKey],
                pendingRouteCardPlan: followup.pendingRouteCardPlan,
                pinnedTileIds: boardCleanup.pinnedTileIds,
                recallFocus: Math.min(RECALL_FOCUS_MAX, boardCleanup.recallFocus + traitReward.recallFocusGain),
                recallMatchesThisFloor: boardCleanup.recallMatchesThisFloor,
                recallBonusScoreThisFloor: boardCleanup.recallBonusScoreThisFloor,
                forgottenTileIdsThisFloor: boardCleanup.forgottenTileIdsThisFloor,
                stickyBlockIndex: traitReward.stickyBlockIndex ?? boardCleanup.stickyBlockIndex,
                ...traitRouteObjective.runPatch,
                ...progress,
                stats: {
                    ...stats,
                    totalScore: runNonNegativeInteger(scoring.totalScore) + runNonNegativeInteger(traitRouteObjective.scoreBonus),
                    currentLevelScore:
                        runNonNegativeInteger(scoring.currentLevelScore) + runNonNegativeInteger(traitRouteObjective.scoreBonus),
                    bestScore: Math.max(
                        runNonNegativeInteger(scoring.bestScore),
                        runNonNegativeInteger(scoring.totalScore) + runNonNegativeInteger(traitRouteObjective.scoreBonus)
                    ),
                    matchesFound: runNonNegativeInteger(stats.matchesFound) + 1,
                    currentStreak: runNonNegativeInteger(scoring.currentStreak),
                    bestStreak: Math.max(runNonNegativeInteger(stats.bestStreak), runNonNegativeInteger(scoring.currentStreak)),
                    highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), runNonNegativeInteger(board.level)),
                    guardTokens: Math.min(
                        MAX_GUARD_TOKENS,
                        runNonNegativeInteger(survivalReward.guardTokens) + runNonNegativeInteger(traitReward.guardTokenGain)
                    ),
                    comboShards: Math.min(
                        MAX_COMBO_SHARDS,
                        runNonNegativeInteger(survivalReward.comboShards) + runNonNegativeInteger(traitRouteObjective.comboShardGain)
                    ),
                    tileTraitMatches: addTileTraitCountStats(stats.tileTraitMatches, [tileMatchA, tileMatchB])
                },
                timerState: clearResolveState(run)
            };
            const cleanedNextRun = clearFinalPairEnemyHazardOccupationForRun(nextRun);
            const completionBoard = cleanedNextRun.board ?? spunG.board;
            return cleanedNextRun.status === 'gameOver'
                ? cleanedNextRun
                : isBoardComplete(completionBoard)
                  ? finalizeLevel(cleanedNextRun, completionBoard, execution)
                  : cleanedNextRun;
        }
    
        const gambitDecoy =
            ta.pairKey === DECOY_PAIR_KEY || tb.pairKey === DECOY_PAIR_KEY || tc.pairKey === DECOY_PAIR_KEY;
        const mismatch = resolveMismatchTurnTransition({
            run,
            board: run.board,
            tileIds: [aId, bId, cId],
            sourceTiles: [ta, tb, tc],
            triesDelta: GAMBIT_FAIL_EXTRA_TRIES,
            decoyTouched: gambitDecoy
        });
        return {
            ...mismatch,
            gambitThirdFlipUsed: true,
            gambitAvailableThisFloor: false,
            powersUsedThisRun: true
        };
    };
    
    const resolveTwoFlippedTiles = (
        run: RunState,
        encorePairKeys: string[],
        execution?: BoardTurnExecutionContext
    ): RunState => {
        const flippedTileIds = flippedTileIdsForRun(run);
        if (!run.board || !flippedTileIds || flippedTileIds.length !== 2) {
            return run;
        }
        const [firstId, secondId] = flippedTileIds;
        const firstTile = run.board.tiles.find((tile) => tile.id === firstId);
        const secondTile = run.board.tiles.find((tile) => tile.id === secondId);
    
        if (!firstTile || !secondTile) {
            return run;
        }
    
        const isMatch = tilesArePairMatch(firstTile, secondTile);
    
        if (isMatch) {
            const matchClaimContext = deriveMatchClaimContext({
                firstTile,
                firstTileId: firstId,
                run,
                secondTile,
                secondTileId: secondId
            });
            const {
                anchorSealClaimed,
                catalystAltarUpgraded,
                dungeonReward,
                dungeonTrapResolvedDelta,
                claimedFindableKind,
                findableComboShardGain,
                findableSafeHazardWardGain,
                findableScoreBonus,
                findablesClaimedDelta,
                loadedGatewayClaimed,
                matchedDungeonKeyKind,
                matchedDungeonKind,
                matchedPairKey,
                mimicCacheBite,
                mimicCacheClaimed,
                mimicCacheFatalBite,
                mimicCacheGuardBite,
                parasiteVesselConverted,
                pinLatticeRewarded,
                routeCardReward,
                usedWild
            } = matchClaimContext;
            const findableReward = resolveFindableMatchRewardThroughGameplayCore(
                run,
            claimedFindableKind,
            `findable-match:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:${matchedPairKey}:match`,
            execution
            );
            const resolvedFindableComboShardGain = findableReward.migrated
                ? findableReward.comboShardGain
                : findableComboShardGain;
            const resolvedFindableSafeHazardWardGain = findableReward.migrated
                ? findableReward.safeHazardWardGain
                : findableSafeHazardWardGain;
            const resolvedFindableScoreBonus = findableReward.migrated
                ? findableReward.scoreGain
                : findableScoreBonus;
            const resolvedFindableScoutGain = findableReward.migrated
                ? findableReward.scoutRevealGain
                : claimedFindableKind === 'scout_glint' ? 1 : 0;
    
            const resolution = resolveTurnMatchBoardResolution({
                run,
                board: run.board,
                context: matchClaimContext,
                firstTile,
                secondTile,
                findableScoutGain: resolvedFindableScoutGain,
                firstTileId: firstId,
                secondTileId: secondId
            });
            const {
                board,
                findableScout,
                cascadeHazard,
                chunkBreak,
                fragileCacheClaimed,
                tollCacheClaimed,
                fuseCacheClaimed,
                fuseCacheFresh,
                enemyDamage,
                hazardDamage,
                lastPairHazardClear,
                lanternScout,
                omenScout
            } = resolution;
            /*
             * A findable that went with the chunk is paid the way a matched findable is paid, through
             * the same adapter with its own command id, so its score and shards land in the same sums.
             */
            const chunkFindable = chunkBreak.claimedFindableKind
                ? resolveFindableMatchRewardThroughGameplayCore(
                      run,
                      chunkBreak.claimedFindableKind,
                      `findable-chunk:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:${matchedPairKey}`,
                      execution
                  )
                : { scoreGain: 0, comboShardGain: 0, safeHazardWardGain: 0, scoutRevealGain: 0, migrated: false, commands: [], events: [] };
            const traitReward = resolveTileTraitEffects({
                run,
                board: run.board,
            sourceTiles: [firstTile, secondTile],
            source: 'match',
            gameplayEffectContext: execution
            });
            const scoring = resolveTurnMatchScoringSummary({
                run,
                sourceBoard: run.board,
                resolvedBoard: board,
                matchedPairKey,
                matchedTiles: [firstTile, secondTile],
                encorePairKeys,
                findableScoreBonus: resolvedFindableScoreBonus + traitReward.scoreBonus,
                chunkScore: chunkBreak.score + chunkFindable.scoreGain,
                routeCardScore: routeCardReward.score,
                dungeonScore: dungeonReward.score,
                enemyDamageScore: enemyDamage.score,
                hazardDamageScore: hazardDamage.score,
                fragileCacheClaimed,
                fuseCacheFresh,
                pinLatticeRewarded,
                tollCacheClaimed
            });
            const survivalReward = calculateResolvedMatchSurvivalReward({
                catalystAltarUpgraded,
                currentStreak: scoring.currentStreak,
                dungeonReward,
                findableComboShardGain: resolvedFindableComboShardGain + traitReward.comboShardGain + chunkBreak.comboShardGain + chunkFindable.comboShardGain,
                mimicCacheBite,
                mimicCacheFatalBite,
                mimicCacheGuardBite,
                routeCardReward,
                run
            });
            execution?.traitInteractionTags?.push(...traitReward.interactionTags);
            const traitRouteObjective = applyTraitRouteObjectiveProgress(run, traitReward.interactionTags);
            const lives = survivalReward.lives;
            const routeFavor = gainRelicFavor(run, routeCardReward.relicFavor + dungeonReward.relicFavor + traitReward.relicFavorGain);
    
            const wildMatch = usedWild && runNonNegativeInteger(run.wildMatchesRemaining) > 0
                ? consumeWildMatchThroughGameplayCore(
                      run,
                      firstTile.pairKey === WILD_PAIR_KEY ? firstTile.id : secondTile.id,
                  firstTile.pairKey === WILD_PAIR_KEY ? secondTile.id : firstTile.id,
                  `wild-match:${run.runSeed}:${run.board.level}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:match`,
                  execution
                  )
                : { run, commands: [], events: [] };
    
            const spun = rotateAnchorSealPressure(run, board);
            const followup = resolveTurnMatchFollowup({
                run,
                matchedPairKey,
                encoreKey: scoring.encoreKey,
                loadedGatewayClaimed,
                dungeonGatewayRouteType: dungeonReward.gatewayRouteType
            });
            const boardCleanup = resolveTurnMatchBoardCleanup({
                run,
                board: run.board,
                matchedTileIds: [firstId, secondId],
                firstMatchedTileId: firstId,
                recallBonus: scoring.recallBonus
            });
            const economy = resolveTurnMatchEconomy({
                run,
                routeCardShopGold: routeCardReward.shopGold,
                dungeonShopGold: dungeonReward.shopGold + chunkBreak.treasureGold,
                dungeonKeysDelta: dungeonReward.keysHeldDelta,
                dungeonMasterKeysDelta: dungeonReward.masterKeysHeldDelta,
                tollCacheClaimed,
                fuseCacheClaimed,
                fuseCacheFresh,
                matchedDungeonKind,
                matchedDungeonKeyKind
            });
            const defeatedDungeonEnemies =
                dungeonReward.enemiesDefeated +
                enemyDamage.defeated +
                hazardDamage.bossDefeated +
                lastPairHazardClear.bossesDefeated;
            const defeatedEnemyHazards = hazardDamage.defeated + lastPairHazardClear.defeated;
            const progress = resolveTurnMatchProgress({
                run,
                cursedMatchedEarly: scoring.cursedMatchedEarly,
                findablesClaimedDelta: findablesClaimedDelta + (chunkBreak.claimedFindableKind ? 1 : 0),
                routeCardSafeHazardWardCharges: routeCardReward.safeHazardWardCharges,
                findableSafeHazardWardGain: resolvedFindableSafeHazardWardGain,
                cascadeHazardTriggered: cascadeHazard.triggered,
                chunkPairsBroken: chunkBreak.brokenPairKeys.length,
                chunkScore: chunkBreak.score + chunkFindable.scoreGain,
                chunkTier: chunkBreak.tier,
                chainAfter: scoring.currentStreak,
                chunkWardensDefeated: chunkBreak.enemiesDefeated,
                chunkDroppedPairs: chunkBreak.droppedPairKeys.length,
                chunkMomentumPairs: chunkBreak.brokenPairKeys.length,
                chunkRippleWaves: chunkBreak.waves,
                fragileCacheClaimed,
                tollCacheClaimed,
                fuseCacheClaimed,
                fuseCacheFresh,
                lanternScouted: lanternScout.scouted,
                findableScouted: findableScout.scouted,
                omenScouted: omenScout.scouted,
                mimicCacheClaimed,
                mimicCacheBite,
                mimicCacheGuardBite,
                anchorSealUsed: spun.anchorSealUsed,
                anchorSealClaimed,
                loadedGatewayClaimed,
                catalystAltarUpgraded,
                parasiteVesselConverted,
                pinLatticeRewarded,
                defeatedDungeonEnemies,
                defeatedEnemyHazards,
                openedDungeonTreasures: dungeonReward.treasuresOpened + chunkBreak.treasuresSpilled,
                resolvedDungeonTraps: dungeonTrapResolvedDelta,
                usedDungeonGateways: dungeonReward.gatewaysUsed
            });
            const stats = normalizeSessionStats(run.stats);
    
        const journaledRun = execution
            ? wildMatch.run
            : appendGameplayJournal(
                  wildMatch.run,
                  [...wildMatch.commands, ...findableReward.commands, ...(traitReward.gameplayCommands ?? [])],
                  [...wildMatch.events, ...findableReward.events, ...(traitReward.gameplayEvents ?? [])]
              );
            const nextRun: RunState = {
                ...journaledRun,
                status: mimicCacheFatalBite ? 'gameOver' : 'playing',
                lives,
                board: spun.board,
                shiftingSpotlightNonce: spun.shiftingSpotlightNonce,
                powersUsedThisRun: usedWild ? true : run.powersUsedThisRun,
                wildMatchesRemaining: runNonNegativeInteger(journaledRun.wildMatchesRemaining),
                peekCharges: runNonNegativeInteger(run.peekCharges) + runNonNegativeInteger(traitReward.peekChargeGain),
                shuffleCharges: runNonNegativeInteger(run.shuffleCharges) + runNonNegativeInteger(traitReward.shuffleChargeGain),
                regionShuffleCharges:
                    runNonNegativeInteger(run.regionShuffleCharges) + runNonNegativeInteger(traitReward.regionShuffleChargeGain),
                flashPairCharges: runNonNegativeInteger(run.flashPairCharges) + runNonNegativeInteger(traitReward.flashPairChargeGain),
                shopGold: runNonNegativeInteger(economy.shopGold) + runNonNegativeInteger(traitReward.shopGoldGain),
                dungeonKeys: economy.dungeonKeys,
                dungeonMasterKeys: economy.dungeonMasterKeys,
                bonusRelicPicksNextOffer: routeFavor.bonusRelicPicksNextOffer,
                favorBonusRelicPicksNextOffer: routeFavor.favorBonusRelicPicksNextOffer,
                relicFavorProgress: routeFavor.relicFavorProgress,
                nBackMatchCounter: followup.nBackMatchCounter,
                nBackAnchorPairKey: followup.nBackAnchorPairKey,
                matchedPairKeysThisRun: [...runStringArray(run.matchedPairKeysThisRun), scoring.encoreKey],
                pendingRouteCardPlan: followup.pendingRouteCardPlan,
                pinnedTileIds: boardCleanup.pinnedTileIds,
                recallFocus: Math.min(RECALL_FOCUS_MAX, boardCleanup.recallFocus + traitReward.recallFocusGain),
                recallMatchesThisFloor: boardCleanup.recallMatchesThisFloor,
                recallBonusScoreThisFloor: boardCleanup.recallBonusScoreThisFloor,
                forgottenTileIdsThisFloor: boardCleanup.forgottenTileIdsThisFloor,
                stickyBlockIndex: traitReward.stickyBlockIndex ?? boardCleanup.stickyBlockIndex,
                ...traitRouteObjective.runPatch,
                ...progress,
                stats: {
                    ...stats,
                    totalScore: runNonNegativeInteger(scoring.totalScore) + runNonNegativeInteger(traitRouteObjective.scoreBonus),
                    currentLevelScore:
                        runNonNegativeInteger(scoring.currentLevelScore) + runNonNegativeInteger(traitRouteObjective.scoreBonus),
                    bestScore: Math.max(
                        runNonNegativeInteger(scoring.bestScore),
                        runNonNegativeInteger(scoring.totalScore) + runNonNegativeInteger(traitRouteObjective.scoreBonus)
                    ),
                    matchesFound: runNonNegativeInteger(stats.matchesFound) + 1,
                    currentStreak: runNonNegativeInteger(scoring.currentStreak),
                    bestStreak: Math.max(runNonNegativeInteger(stats.bestStreak), runNonNegativeInteger(scoring.currentStreak)),
                    highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), runNonNegativeInteger(board.level)),
                    guardTokens: Math.min(
                        MAX_GUARD_TOKENS,
                        runNonNegativeInteger(survivalReward.guardTokens) + runNonNegativeInteger(traitReward.guardTokenGain)
                    ),
                    comboShards: Math.min(
                        MAX_COMBO_SHARDS,
                        runNonNegativeInteger(survivalReward.comboShards) + runNonNegativeInteger(traitRouteObjective.comboShardGain)
                    ),
                    tileTraitMatches: addTileTraitCountStats(stats.tileTraitMatches, [firstTile, secondTile])
                },
                timerState: clearResolveState(run)
            };
    
            const cleanedNextRun = clearFinalPairEnemyHazardOccupationForRun(nextRun);
            const completionBoard = cleanedNextRun.board ?? spun.board;
            return cleanedNextRun.status === 'gameOver'
                ? cleanedNextRun
                : isBoardComplete(completionBoard)
                  ? finalizeLevel(cleanedNextRun, completionBoard, execution)
                  : cleanedNextRun;
        }
    
        const decoyTouch =
            firstTile.pairKey === DECOY_PAIR_KEY || secondTile.pairKey === DECOY_PAIR_KEY;
        return resolveMismatchTurnTransition({
            run,
            board: run.board,
            tileIds: [firstId, secondId],
            sourceTiles: [firstTile, secondTile],
            triesDelta: 1,
            decoyTouched: decoyTouch
        });
    };
    
    const resolveBoardTurn = (
        run: RunState,
        encorePairKeys: string[] = [],
        execution?: BoardTurnExecutionContext
    ): RunState => {
        if (run.status === 'gameOver') {
            return run;
        }
        if (!run.board) {
            return run;
        }
        const flippedTileIds = flippedTileIdsForRun(run);
        if (!flippedTileIds) {
            return run;
        }
        if (flippedTileIds.length === 3) {
            return resolveGambitThree(run, encorePairKeys, execution);
        }
        if (flippedTileIds.length !== 2) {
            return run;
        }
        return resolveTwoFlippedTiles(run, encorePairKeys, execution);
    };
    return resolveBoardTurn;
};
