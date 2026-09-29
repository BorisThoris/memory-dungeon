import {
    INITIAL_REGION_SHUFFLE_CHARGES,
    type BoardState,
    type MutatorId,
    type RunState
} from './contracts';
import { applyFloorCurio, pickFloorCurio } from './floor-curio-rules';
import { carriedChainForNextFloor } from './chain-carryover-rules';
import { countFindablePairs } from './board-tile-generation-rules';
import { carryMissBank } from './miss-bank';
import { createTimerState } from './run-timer-rules';
import { calculateRating } from './scoring-rules';
import { normalizeSessionStats } from './session-stats-rules';
import { runNonNegativeInteger } from './run-number-guards';

export interface CreateNextFloorRunStateOptions {
    activeMutators: MutatorId[];
    board: BoardState;
    memorizeRemainingMs: number;
}

export const createNextFloorRunState = (
    run: RunState,
    options: CreateNextFloorRunStateOptions
): RunState => {
    const nextBoard = options.board;
    const stats = normalizeSessionStats(run.stats);
    /*
     * The combo and its whole ladder cross the boundary (`chain-carryover-rules.ts`): the streak,
     * the pairs the cascade took and the momentum a skipped study bought all persist until a miss,
     * so the meter a player climbed is the meter they open the next floor on.
     */
    const carriedChain = carriedChainForNextFloor(stats.currentStreak);

    const nextRun: RunState = {
        ...run,
        status: 'memorize',
        activeMutators: options.activeMutators,
        board: nextBoard,
        debugPeekActive: false,
        pinnedTileIds: [],
        stickyBlockIndex: null,
        undoUsesThisFloor: 1,
        gambitAvailableThisFloor: true,
        gambitThirdFlipUsed: false,
        peekRevealedTileIds: [],
        shuffleUsedThisFloor: false,
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
        chunkPairsThisChain: runNonNegativeInteger(run.chunkPairsThisChain),
        skipMomentumThisChain: runNonNegativeInteger(run.skipMomentumThisChain),
        feverBreaksThisFloor: 0,
        // The floor's own record starts empty: a combo carried in is not a chain this board saw.
        bestChainThisFloor: 0,
        peakChainTierThisFloor: 'none',
        chunkPairsDroppedThisFloor: 0,
        bestRippleThisFloor: 0,
        turnsThisFloor: 0,
        missBank: carryMissBank(run, nextBoard.level),
        largestChunkScoreThisFloor: 0,
        magpieTheftsThisFloor: 0,
        restlessDriftsThisFloor: 0,
        skittishFlinchesThisFloor: 0,
        lanternLitTileIds: [],
        lanternLightsThisFloor: 0,
        heatPerkTurnsThisFloor: 0,
        // Pair keys repeat from floor to floor, so a carried anchor would mark a card on the wrong board.
        nBackAnchorPairKey: null,
        nBackMatchCounter: 0,
        anchorClaimsThisFloor: 0,
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
            currentStreak: carriedChain
        },
        comboLinksCarried: carriedChain
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
