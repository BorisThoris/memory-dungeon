import {
    INITIAL_REGION_SHUFFLE_CHARGES,
    type BoardState,
    type MutatorId,
    type RunState
} from './contracts';
import { applyFloorCurio, pickFloorCurio } from './floor-curio-rules';
import { boardHasGlassDecoy } from './board-inspection';
import { countFindablePairs } from './board-tile-generation-rules';
import { createTimerState } from './run-timer-rules';
import { calculateRating } from './scoring-rules';
import { normalizeSessionStats } from './session-stats-rules';

export interface CreateNextFloorRunStateOptions {
    lives: number;
    activeMutators: MutatorId[];
    board: BoardState;
    parasiteFloors: number;
    memorizeRemainingMs: number;
}

export const createNextFloorRunState = (
    run: RunState,
    options: CreateNextFloorRunStateOptions
): RunState => {
    const nextBoard = options.board;
    const stats = normalizeSessionStats(run.stats);

    const nextRun: RunState = {
        ...run,
        status: 'memorize',
        lives: options.lives,
        activeMutators: options.activeMutators,
        board: nextBoard,
        debugPeekActive: false,
        pendingMemorizeBonusMs: 0,
        pinnedTileIds: [],
        destroyPairCharges: run.destroyPairCharges,
        parasiteFloors: options.parasiteFloors,
        stickyBlockIndex: null,
        undoUsesThisFloor: 1,
        gambitAvailableThisFloor: true,
        gambitThirdFlipUsed: false,
        peekRevealedTileIds: [],
        shuffleUsedThisFloor: false,
        destroyUsedThisFloor: false,
        decoyFlippedThisFloor: false,
        glassDecoyActiveThisFloor: boardHasGlassDecoy(nextBoard),
        cursedMatchedEarlyThisFloor: false,
        matchResolutionsThisFloor: 0,
        findablesClaimedThisFloor: 0,
        findablesTotalThisFloor: countFindablePairs(nextBoard.tiles),
        recallFocus: 0,
        recallMatchesThisFloor: 0,
        recallMistakesThisFloor: 0,
        recallBonusScoreThisFloor: 0,
        forgottenTileIdsThisFloor: [],
        floorCurioGreeted: false,
        chunkBreaksThisFloor: 0,
        chunkPairsBrokenThisFloor: 0,
        chunkScoreThisFloor: 0,
        chunkPairsThisChain: 0,
        feverBreaksThisFloor: 0,
        bestChainThisFloor: 0,
        chunkPairsDroppedThisFloor: 0,
        bestRippleThisFloor: 0,
        turnsThisFloor: 0,
        largestChunkScoreThisFloor: 0,
        magpieTheftsThisFloor: 0,
        magpieScaredOffThisFloor: 0,
        shiftingSpotlightNonce: 0,
        flashPairRevealedTileIds: [],
        regionShuffleCharges: INITIAL_REGION_SHUFFLE_CHARGES,
        timerState: createTimerState({ memorizeRemainingMs: options.memorizeRemainingMs }),
        lastLevelResult: null,
        stats: {
            ...stats,
            tries: 0,
            currentLevelScore: 0,
            rating: calculateRating(0),
            highestLevel: Math.max(stats.highestLevel, nextBoard.level),
            currentStreak: 0
        }
    };
    /*
     * Whoever lives on the next floor moves in before anything else reads the run: their peek
     * charge and their token are part of the floor the player is about to be handed,
     * not a bonus applied to a floor already underway.
     */
    return applyFloorCurio(
        nextRun,
        pickFloorCurio(run.runSeed, nextBoard.level, run.runRulesVersion)
    );
};
