import {
    MAX_COMBO_SHARDS,
    type BoardState,
    type FindableKind,
    type RunState,
    type Tile
} from './contracts';
import { chunkBreakMomentumPairs } from './chunk-break-rules';
import { isBoardComplete } from './board-inspection';
import { DECOY_PAIR_KEY, WILD_PAIR_KEY } from './tile-identity';
import { tilesArePairMatch } from './scoring-rules';
import { clearResolveState } from './run-timer-rules';
import { rotateRunShiftingSpotlight } from './shifting-spotlight-rules';
import { deriveMatchClaimContext } from './match-claim-rules';
import { selectGambitMatchedPair } from './gambit-match-rules';
import { resolveMismatchTurnTransition } from './turn-mismatch-rules';
import { floorHitTurnCeiling } from './floor-par';
import { calculateResolvedMatchSurvivalReward } from './turn-match-reward-rules';
import { resolveTurnMatchFollowup } from './turn-match-followup-rules';
import { resolveTurnMatchBoardCleanup } from './turn-match-board-cleanup-rules';
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
    comboShardGain: number;
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

/**
 * The turn ceiling (thesis §42.2), applied after a match and a miss alike: a floor still open on
 * its ceiling turn ends the run. A floor that cleared on that turn has already left `playing`
 * and is a clear. Nothing else ends a run mid-floor.
 */
export const applyTurnCeiling = (run: RunState): RunState =>
    floorHitTurnCeiling(run)
        ? {
              ...run,
              status: 'gameOver',
              runEndReason: 'turn_ceiling',
              board: run.board ? { ...run.board, flippedTileIds: [] } : run.board,
              timerState: clearResolveState(run)
          }
        : run;

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
            findableComboShardGain,
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
        const resolvedFindableComboShardGain = findableReward.migrated
            ? findableReward.comboShardGain
            : findableComboShardGain;
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
         * the same adapter with its own command id, so its score and shards land in the same sums.
         */
        const chunkFindable = chunkBreak.claimedFindableKind
            ? resolveFindableMatchRewardThroughGameplayCore(
                  run,
                  chunkBreak.claimedFindableKind,
                  `findable-chunk:${run.runSeed}:${sourceBoard.level}:${matchResolutions}:${matchedPairKey}`,
                  execution
              )
            : { scoreGain: 0, comboShardGain: 0, migrated: false, commands: [], events: [] };
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
        const survivalReward = calculateResolvedMatchSurvivalReward({
            currentStreak: scoring.currentStreak,
            findableComboShardGain:
                resolvedFindableComboShardGain + chunkBreak.comboShardGain + chunkFindable.comboShardGain,
            run
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
            board: sourceBoard,
            matchedTileIds: [firstTile.id, secondTile.id],
            firstMatchedTileId: firstTile.id,
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
            status: 'playing',
            board: spun.board,
            shiftingSpotlightNonce: spun.shiftingSpotlightNonce,
            powersUsedThisRun: usedWild ? true : run.powersUsedThisRun,
            wildMatchesRemaining: runNonNegativeInteger(journaledRun.wildMatchesRemaining),
            peekCharges: runNonNegativeInteger(run.peekCharges) + runNonNegativeInteger(traitReward.peekChargeGain),
            // No trait pays in these any more; they are carried through normalized, as every other
            // counter a resolved match writes back is.
            shuffleCharges: runNonNegativeInteger(run.shuffleCharges),
            regionShuffleCharges: runNonNegativeInteger(run.regionShuffleCharges),
            flashPairCharges: runNonNegativeInteger(run.flashPairCharges),
            nBackMatchCounter: followup.nBackMatchCounter,
            nBackAnchorPairKey: followup.nBackAnchorPairKey,
            matchedPairKeysThisRun: [...runStringArray(run.matchedPairKeysThisRun), scoring.encoreKey],
            pinnedTileIds: boardCleanup.pinnedTileIds,
            recallFocus: boardCleanup.recallFocus,
            recallMatchesThisFloor: boardCleanup.recallMatchesThisFloor,
            recallBonusScoreThisFloor: boardCleanup.recallBonusScoreThisFloor,
            forgottenTileIdsThisFloor: boardCleanup.forgottenTileIdsThisFloor,
            stickyBlockIndex: traitReward.stickyBlockIndex ?? boardCleanup.stickyBlockIndex,
            ...progress,
            stats: {
                ...stats,
                totalScore: runNonNegativeInteger(scoring.totalScore),
                currentLevelScore: runNonNegativeInteger(scoring.currentLevelScore),
                bestScore: Math.max(runNonNegativeInteger(scoring.bestScore), runNonNegativeInteger(scoring.totalScore)),
                matchesFound: runNonNegativeInteger(stats.matchesFound) + 1,
                currentStreak: runNonNegativeInteger(scoring.currentStreak),
                bestStreak: Math.max(runNonNegativeInteger(stats.bestStreak), runNonNegativeInteger(scoring.currentStreak)),
                highestLevel: Math.max(runNonNegativeInteger(stats.highestLevel), runNonNegativeInteger(board.level)),
                comboShards: Math.min(MAX_COMBO_SHARDS, runNonNegativeInteger(survivalReward.comboShards)),
                tileTraitMatches: addTileTraitCountStats(stats.tileTraitMatches, [firstTile, secondTile])
            },
            timerState: clearResolveState(run)
        };

        const cleanedNextRun = releaseStrandedStasisBlock(nextRun);
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
            return applyTurnCeiling(resolveGambitThree(run, encorePairKeys, execution));
        }
        if (flippedTileIds.length !== 2) {
            return run;
        }
        return applyTurnCeiling(resolveTwoFlippedTiles(run, encorePairKeys, execution));
    };
    return resolveBoardTurn;
};
