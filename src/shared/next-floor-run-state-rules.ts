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
     * The chain crosses the boundary, capped short of the Clean rung (`chain-carryover-rules.ts`):
     * the momentum is the player's, every tier is earned on the board that shows it. The cascade
     * momentum does not cross at all.
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
        chunkPairsThisChain: 0,
        skipMomentumThisChain: 0,
        feverBreaksThisFloor: 0,
        // The carried chain is a chain this floor really holds, so it is this floor's record until
        // a longer one lands. It is under the Clean rung by construction, so it can never credit
        // `sharpFloorsThisRun` or `feverFloorsThisRun` for a rung the floor did not climb.
        bestChainThisFloor: carriedChain,
        peakChainTierThisFloor: 'none',
        chunkPairsDroppedThisFloor: 0,
        bestRippleThisFloor: 0,
        turnsThisFloor: 0,
        missBank: carryMissBank(run, nextBoard.level),
        largestChunkScoreThisFloor: 0,
        magpieTheftsThisFloor: 0,
        restlessDriftsThisFloor: 0,
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
