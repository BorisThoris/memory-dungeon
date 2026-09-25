import {
    type BoardState,
    type FindableKind,
    type RunState,
    type Tile
} from './contracts';
import { chunkBreakMomentumPairs } from './chunk-break-rules';
import { higherChainTier, runChainTier } from './chain-tier-rules';
import { isBoardComplete } from './board-inspection';
import { WILD_PAIR_KEY } from './tile-identity';
import { tilesArePairMatch } from './scoring-rules';
import { clearResolveState } from './run-timer-rules';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { resolveLanternLight } from './lantern-light-rules';
import { ANCHOR_BONUS_LINKS, resolveAnchorAfterMatch } from './n-back-anchor-rules';
import { applyRestlessDrift, resolveRestlessDrift } from './restless-floor-rules';
import { hasMutator } from './mutators';
import { deriveMatchClaimContext } from './match-claim-rules';
import { selectGambitMatchedPair } from './gambit-match-rules';
import { resolveMismatchTurnTransition } from './turn-mismatch-rules';
import { applyMissBudget } from './miss-bank';
import { resolveTurnMatchFollowup } from './turn-match-followup-rules';
import { resolveTurnMatchBoardCleanup, selectStickyFingersBlockIndex } from './turn-match-board-cleanup-rules';
import { resolveTurnMatchProgress } from './turn-match-progress-rules';
import { resolveTurnMatchBoardResolution } from './turn-match-board-resolution-rules';
import { resolveTurnMatchScoringSummary } from './turn-match-scoring-summary-rules';
import { releaseStrandedStasisBlock, resolveTileTraitEffects } from './tile-trait-rules';
import { appendGameplayJournal } from './gameplay-journal';
import type { GameplayCommand, GameplayEvent } from './gameplay-core-contracts';
import { addTileTraitCountStats, normalizeSessionStats } from './session-stats-rules';
import { runFilteredStringArrayOrNull, runStringArray } from './run-array-guards';
import { runNonNegativeInteger } from './run-number-guards';
import type { TileTraitInteractionTag } from './tile-trait-rules';

const GAMBIT_FAIL_EXTRA_TRIES = 1;

export interface BoardTurnFindableRewardResult {
    commands: GameplayCommand[];
    events: GameplayEvent[];
    scoreGain: number;
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

interface ResolvedMatchInput {
    run: RunState;
    board: BoardState;
    firstTile: Tile;
    secondTile: Tile;
    thirdTileId?: string;
    encorePairKeys: string[];
    /** Suffix on the command ids the turn issues, so a gambit match and a plain match never collide. */
    commandTag: 'gambit' | 'match';
    execution?: BoardTurnExecutionContext;
}

/*
 * The miss budget (`miss-bank.ts`) is applied after every resolved turn: a miss spends one, and a
 * miss with none left ends the run. Nothing else ends a run mid-floor.
 */

export const createResolveBoardTurnTransition = ({
    finalizeLevel,
    resolveFindableMatchReward: resolveFindableMatchRewardThroughGameplayCore,
    consumeWildMatch: consumeWildMatchThroughGameplayCore
}: BoardTurnTransitionDependencies) => {
    /**
     * A matched pair, whether it came from two flips or from the gambit's three. What a match
     * claims, what its pop takes with it, what it pays, and the run counters it moves.
     */
    const resolveMatchedPair = ({
        run,
        board: sourceBoard,
        firstTile,
        secondTile,
        thirdTileId,
        encorePairKeys,
        commandTag,
        execution
    }: ResolvedMatchInput): RunState => {
        const {
            claimedFindableKind,
            findableScoreBonus,
            findablesClaimedDelta,
            matchedPairKey,
            usedWild
        } = deriveMatchClaimContext(firstTile, secondTile);
        const matchResolutions = runNonNegativeInteger(run.matchResolutionsThisFloor);
        const findableReward = resolveFindableMatchRewardThroughGameplayCore(
            run,
            claimedFindableKind,
            `findable-match:${run.runSeed}:${sourceBoard.level}:${matchResolutions}:${matchedPairKey}:${commandTag}`,
            execution
        );
        const resolvedFindableScoreBonus = findableReward.migrated ? findableReward.scoreGain : findableScoreBonus;

        const { board, chunkBreak } = resolveTurnMatchBoardResolution({
            run,
            board: sourceBoard,
            firstTileId: firstTile.id,
            secondTileId: secondTile.id,
            thirdTileId
        });
        /*
         * A findable that went with the chunk is paid the way a matched findable is paid, through
         * the same adapter with its own command id, so its score lands in the same sum.
         */
        const chunkFindable = chunkBreak.claimedFindableKind
            ? resolveFindableMatchRewardThroughGameplayCore(
                  run,
                  chunkBreak.claimedFindableKind,
                  `findable-chunk:${run.runSeed}:${sourceBoard.level}:${matchResolutions}:${matchedPairKey}`,
                  execution
              )
            : { scoreGain: 0, migrated: false, commands: [], events: [] };
        const traitReward = resolveTileTraitEffects({
            run,
            board: sourceBoard,
            sourceTiles: [firstTile, secondTile],
            source: 'match',
            gameplayEffectContext: execution
        });
        const scoring = resolveTurnMatchScoringSummary({
            run,
            sourceBoard,
            resolvedBoard: board,
            matchedPairKey,
            encorePairKeys,
            findableScoreBonus: resolvedFindableScoreBonus + traitReward.scoreBonus,
            chunkScore: chunkBreak.score + chunkFindable.scoreGain
        });
        execution?.traitInteractionTags?.push(...traitReward.interactionTags);
        const wildMatch = usedWild && runNonNegativeInteger(run.wildMatchesRemaining) > 0
            ? consumeWildMatchThroughGameplayCore(
                  run,
                  firstTile.pairKey === WILD_PAIR_KEY ? firstTile.id : secondTile.id,
                  firstTile.pairKey === WILD_PAIR_KEY ? secondTile.id : firstTile.id,
                  `wild-match:${run.runSeed}:${sourceBoard.level}:${matchResolutions}:${commandTag}`,
                  execution
              )
            : { run, commands: [], events: [] };

        const spun = rotateRunShiftingSpotlight(run, board);
        const followup = resolveTurnMatchFollowup({
            run,
            encoreKey: scoring.encoreKey
        });
        const boardCleanup = resolveTurnMatchBoardCleanup({
            run,
            matchedTileIds: [firstTile.id, secondTile.id],
            recallBonus: scoring.recallBonus
        });
        const progress = resolveTurnMatchProgress({
            run,
            cursedMatchedEarly: scoring.cursedMatchedEarly,
            findablesClaimedDelta: findablesClaimedDelta + (chunkBreak.claimedFindableKind ? 1 : 0),
            chunkPairsBroken: chunkBreak.brokenPairKeys.length,
            chunkScore: chunkBreak.score + chunkFindable.scoreGain,
            chunkTier: chunkBreak.tier,
            chainAfter: scoring.currentStreak,
            chunkDroppedPairs: chunkBreak.droppedPairKeys.length,
            chunkMomentumPairs: chunkBreakMomentumPairs(chunkBreak),
            chunkRippleWaves: chunkBreak.waves
        });
        /*
         * The restless floor moves last, on the board the turn actually produced, once the turn
         * count it keys on has ticked. It never touches a pinned card.
         */
        const drift = hasMutator(run, 'restless_floor')
            ? resolveRestlessDrift({
                  board: spun.board,
                  turnsThisFloor: progress.turnsThisFloor,
                  driftsBefore: runNonNegativeInteger(run.restlessDriftsThisFloor),
                  pinnedTileIds: boardCleanup.pinnedTileIds,
                  runSeed: run.runSeed,
                  rulesVersion: run.runRulesVersion
              })
            : null;
        const boardAfterDrift = drift?.kind === 'drift' ? applyRestlessDrift(spun.board, drift.swaps) : spun.board;
        /*
         * The lantern lights last, on the board the player will look at: after the pop has taken
         * what it takes and any drift has moved what it moves, so a lit face is where it will be.
         */
        const lanternLit = hasMutator(run, 'lantern_light')
            ? resolveLanternLight({
                  board: boardAfterDrift,
                  matchedTileIds: [firstTile.id, secondTile.id],
                  turnsThisFloor: progress.turnsThisFloor,
                  runSeed: run.runSeed,
                  rulesVersion: run.runRulesVersion
              })
            : [];
        const stats = normalizeSessionStats(run.stats);
        /*
         * The anchor (Anchor Chain): read on the board the player will look at next. A matched anchor
         * pays an extra chain link, which the rungs and the miss bank read like any other.
         */
        const anchor = hasMutator(run, 'n_back_anchor')
            ? resolveAnchorAfterMatch({
                  board: boardAfterDrift,
                  anchorPairKeyBefore: run.nBackAnchorPairKey,
                  matchesSinceAnchorBefore: runNonNegativeInteger(run.nBackMatchCounter),
                  matchedPairKey: firstTile.pairKey,
                  runSeed: run.runSeed,
                  rulesVersion: run.runRulesVersion,
                  matchResolutions: runNonNegativeInteger(run.matchResolutionsThisFloor)
              })
            : null;
        const streakAfter = runNonNegativeInteger(scoring.currentStreak) + (anchor?.anchorMatched ? ANCHOR_BONUS_LINKS : 0);

        const journaledRun = execution
            ? wildMatch.run
            : appendGameplayJournal(
                  wildMatch.run,
                  [...wildMatch.commands, ...findableReward.commands, ...(traitReward.gameplayCommands ?? [])],
                  [...wildMatch.events, ...findableReward.events, ...(traitReward.gameplayEvents ?? [])]
              );
        const nextRun: RunState = {
            ...journaledRun,
            status: 'playing',
            board: boardAfterDrift,
            shiftingSpotlightNonce: spun.shiftingSpotlightNonce,
            restlessDriftsThisFloor:
                runNonNegativeInteger(run.restlessDriftsThisFloor) + (drift?.kind === 'drift' ? 1 : 0),
            lanternLitTileIds: lanternLit,
            lanternLightsThisFloor: runNonNegativeInteger(run.lanternLightsThisFloor) + (lanternLit.length > 0 ? 1 : 0),
            powersUsedThisRun: usedWild ? true : run.powersUsedThisRun,
            wildMatchesRemaining: runNonNegativeInteger(journaledRun.wildMatchesRemaining),
            peekCharges: runNonNegativeInteger(run.peekCharges) + runNonNegativeInteger(traitReward.peekChargeGain),
            // No trait pays in these any more; they are carried through normalized, as every other
            // counter a resolved match writes back is.
            shuffleCharges: runNonNegativeInteger(run.shuffleCharges),
            regionShuffleCharges: runNonNegativeInteger(run.regionShuffleCharges),
            flashPairCharges: runNonNegativeInteger(run.flashPairCharges),
            nBackMatchCounter: anchor ? anchor.matchesSinceAnchor : followup.nBackMatchCounter,
            nBackAnchorPairKey: anchor ? anchor.anchorPairKey : null,
            anchorClaimsThisFloor: runNonNegativeInteger(run.anchorClaimsThisFloor) + (anchor?.anchorMatched ? 1 : 0),
            matchedPairKeysThisRun: [...runStringArray(run.matchedPairKeysThisRun), scoring.encoreKey],
            pinnedTileIds: boardCleanup.pinnedTileIds,
            recallFocus: boardCleanup.recallFocus,
            recallMatchesThisFloor: boardCleanup.recallMatchesThisFloor,
            recallBonusScoreThisFloor: boardCleanup.recallBonusScoreThisFloor,
            forgottenTileIdsThisFloor: boardCleanup.forgottenTileIdsThisFloor,
            stickyBlockIndex: traitReward.stickyBlockIndex ?? selectStickyFingersBlockIndex(run, boardAfterDrift, firstTile.id),
            ...progress,
            stats: {
                ...stats,
                totalScore: runNonNegativeInteger(scoring.totalScore),
                currentLevelScore: runNonNegativeInteger(scoring.currentLevelScore),
                bestScore: Math.max(runNonNegativeInteger(scoring.bestScore), runNonNegativeInteger(scoring.totalScore)),
                matchesFound: runNonNegativeInteger(stats.matchesFound) + 1,
                currentStreak: streakAfter,
                bestStreak: Math.max(runNonNegativeInteger(stats.bestStreak), streakAfter),
                highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), runNonNegativeInteger(board.level)),
                tileTraitMatches: addTileTraitCountStats(stats.tileTraitMatches, [firstTile, secondTile])
            },
            timerState: clearResolveState(run)
        };

        // The rung the HUD now shows, read the way it reads it, kept as the floor's and the run's peak.
        const shownTier = runChainTier(nextRun);
        const cleanedNextRun = releaseStrandedStasisBlock({
            ...nextRun,
            peakChainTierThisFloor: higherChainTier(run.peakChainTierThisFloor, shownTier),
            peakChainTierThisRun: higherChainTier(run.peakChainTierThisRun, shownTier)
        });
        const completionBoard = cleanedNextRun.board ?? spun.board;
        return isBoardComplete(completionBoard) ? finalizeLevel(cleanedNextRun, completionBoard, execution) : cleanedNextRun;
    };

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
            // The gambit is spent before the match resolves, so a floor clear inside the match
            // sees it spent and can hand the next floor a fresh one.
            return resolveMatchedPair({
                run: {
                    ...run,
                    gambitThirdFlipUsed: true,
                    gambitAvailableThisFloor: false,
                    powersUsedThisRun: true
                },
                board: run.board,
                firstTile: tileMatchA,
                secondTile: tileMatchB,
                thirdTileId: thirdId,
                encorePairKeys,
                commandTag: 'gambit',
                execution
            });
        }

        const mismatch = resolveMismatchTurnTransition({
            run,
            board: run.board,
            tileIds: [aId, bId, cId],
            sourceTiles: [ta, tb, tc],
            triesDelta: GAMBIT_FAIL_EXTRA_TRIES,
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

        if (tilesArePairMatch(firstTile, secondTile)) {
            return resolveMatchedPair({
                run,
                board: run.board,
                firstTile,
                secondTile,
                encorePairKeys,
                commandTag: 'match',
                execution
            });
        }

        return resolveMismatchTurnTransition({
            run,
            board: run.board,
            tileIds: [firstId, secondId],
            sourceTiles: [firstTile, secondTile],
            triesDelta: 1,
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
            return applyMissBudget(run, resolveGambitThree(run, encorePairKeys, execution));
        }
        if (flippedTileIds.length !== 2) {
            return run;
        }
        return applyMissBudget(run, resolveTwoFlippedTiles(run, encorePairKeys, execution));
    };
    return resolveBoardTurn;
};
