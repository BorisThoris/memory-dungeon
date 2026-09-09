import { type RunState } from './contracts';
import { createFlipTileTransition } from './flip-tile-transition';
import { createResolveBoardTurnTransition } from './board-turn-transition';
import { finalizeLevel } from './floor-clear-transition';
import { appendGameplayJournal } from './gameplay-journal';
import { createGameplayDestroyPairCommand } from './gameplay-core-contracts';
import { reduceGameplayCommand } from './gameplay-core';
import {
    consumeWildMatchThroughGameplayCore,
    resolveBoardTurnThroughGameplayCore,
    resolveFindableMatchRewardThroughGameplayCore
} from './gameplay-core-adapters';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';

export {
    countFindablePairs
} from './board-tile-generation-rules';
export {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey,
    isWildPairKey
} from './tile-identity';
export {
    boardHasGlassDecoy,
    getWildTileIdFromBoard,
    inspectBoardFairness,
    inspectRunFairness,
    type BoardFairnessIssue,
    type BoardFairnessIssueCode,
    type BoardFairnessReport,
    type RunFairnessReport,
    isBoardComplete
} from './board-inspection';
export {
    createTimerState,
    disableDebugPeek,
    enableDebugPeek,
    pauseRun,
    resumeRun
} from './run-timer-rules';
export {
    getMatchFloaterAnchorTileIds,
    getMismatchFloaterAnchorTileIds
} from './tile-floater-anchor-rules';
export {
    collectDestroyEligibleTileIds,
    collectPeekEligibleTileIds,
    tileIsDestroyEligiblePreview,
    tileIsPeekEligiblePreview,
    tileIsStrayEligiblePreview
} from './board-power-targeting';
export {
    applyFlashPair,
    applyPeek,
    applyRegionShuffle,
    applyShuffle,
    applyStrayRemove,
    applyTileSwap,
    applyDestroyPairTransition,
    cancelResolvingWithUndo
} from './board-power-actions';
export {
    canDestroyPair,
    canRegionShuffle,
    canRegionShuffleRow,
    canShuffleBoard,
    canSwapHiddenTiles
} from './board-power-availability';
export { togglePinnedTile } from './board-power-state';
export {
    countFullyHiddenPairs
} from './board-inspection';
export {
    eligibleSpotlightPairKeys,
    pickShiftingSpotlightKeys,
    rotateRunShiftingSpotlight,
    rotateShiftingSpotlight,
    shiftingSpotlightMatchDelta
} from './shifting-spotlight-rules';

export {
    PRESENTATION_MUTATOR_MATCH_PENALTIES,
    calculateMatchScore,
    calculateRating,
    computeFlipResolveDelayMs,
    getMemorizeDuration,
    getMemorizeDurationForRun,
    getPresentationMutatorMatchPenalty,
    tilesArePairMatch
} from './scoring-rules';
export {
    buildBoard,
    type BuildBoardOptions
} from './board-build-rules';
export { createNewRun, createWildRun, type CreateRunOptions } from './run-creation-rules';
export {
    advanceToNextLevel
} from './next-floor-transition-rules';
export {
    createRunSummary
} from './run-summary-rules';
export {
    finishMemorizePhase
} from './memorize-phase-rules';

/*
 * The route layer's public surface stood here: generating three choices on a floor clear, applying
 * whichever the player picked, and opening, claiming or skipping the side room a Mystery route led
 * to. All of it went in Gen 173 with the between-floor screen itself.
 */

export { finalizeLevel };

export const flipTile = createFlipTileTransition({ finalizeLevel });

export const applyDestroyPair = (run: RunState, tileId: string): RunState => {
    const command = createGameplayDestroyPairCommand(
        `destroy-pair:${run.runSeed}:${run.board?.level ?? 0}:${run.destroyPairCharges}:${tileId}`,
        tileId
    );
    const result = reduceGameplayCommand(run, command);
    if (!result.accepted) {
        return run;
    }
    return appendGameplayJournal(result.run, [command], result.events);
};

const resolveBoardTurnCompatibility = createResolveBoardTurnTransition({
    finalizeLevel,
    resolveFindableMatchReward: resolveFindableMatchRewardThroughGameplayCore,
    consumeWildMatch: consumeWildMatchThroughGameplayCore
});

export const resolveBoardTurn = (run: RunState, encorePairKeys: string[] = []): RunState => {
    const migrated = resolveBoardTurnThroughGameplayCore(
        run,
        encorePairKeys,
        `board-turn:${run.runSeed}:${run.board?.level ?? 0}:${runNonNegativeInteger(run.matchResolutionsThisFloor)}:${runNonNegativeInteger(normalizeSessionStats(run.stats).tries)}`
    );
    return migrated.migrated
        ? appendGameplayJournal(migrated.run, [migrated.command], migrated.events)
        : resolveBoardTurnCompatibility(run, encorePairKeys);
};
