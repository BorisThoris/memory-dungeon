import type { RunState } from './contracts';
import type { ChainTier } from './chain-tier-rules';
import { decrementRunCounter, runNonNegativeInteger } from './run-number-guards';

export interface TurnMatchProgressResult {
    cursedMatchedEarlyThisFloor: boolean;
    matchResolutionsThisFloor: number;
    findablesClaimedThisFloor: number;
    safeHazardWardChargesThisFloor: number;
    chunkBreaksThisFloor: number;
    chunkPairsBrokenThisFloor: number;
    chunkScoreThisFloor: number;
    chunkPairsThisChain: number;
    feverBreaksThisFloor: number;
    bestChainThisFloor: number;
    feverBreaksThisRun: number;
    biggestChunkPairs: number;
    bestChainThisRun: number;
    chunkPairsDroppedThisFloor: number;
    chunkDropsThisRun: number;
    bestRippleThisFloor: number;
    bestRippleThisRun: number;
    anchorSealChargesThisFloor: number;
    anchorSealUsesThisFloor: number;
}

export interface TurnMatchProgressInput {
    run: RunState;
    /** Pairs the chunk break took this turn; zero when the chain did not buy one. */
    chunkPairsBroken: number;
    chunkScore: number;
    /** The tier the break landed at, and the chain the run holds after this match. */
    chunkTier: ChainTier;
    chainAfter: number;
    /** Pairs that dropped with the break because nothing held them; zero on most turns. */
    chunkDroppedPairs: number;
    /**
     * Pairs that feed the ladder: every pair the break took, the pop's included. Measured
     * (`cascade-balance-simulation.ts`): a ladder fed by the ripple alone reached Fever on four
     * percent of clean floors, because partners rarely sit outside their clump; the pop counts,
     * as a bubble shooter's cascade counts toward its combo.
     */
    chunkMomentumPairs: number;
    /** Waves the ripple ran this turn; zero without a break. */
    chunkRippleWaves: number;
    cursedMatchedEarly: boolean;
    findablesClaimedDelta: number;
    findableSafeHazardWardGain: number;
    anchorSealUsed: boolean;
}

export const resolveTurnMatchProgress = ({
    run,
    chunkPairsBroken,
    chunkScore,
    chunkTier,
    chainAfter,
    chunkDroppedPairs,
    chunkMomentumPairs,
    chunkRippleWaves,
    cursedMatchedEarly,
    findablesClaimedDelta,
    findableSafeHazardWardGain,
    anchorSealUsed
}: TurnMatchProgressInput): TurnMatchProgressResult => {
    const safeFindablesClaimedDelta = runNonNegativeInteger(findablesClaimedDelta);
    const safeFindableWardGain = runNonNegativeInteger(findableSafeHazardWardGain);
    const safePairsBroken = runNonNegativeInteger(chunkPairsBroken);
    const feverBreak = safePairsBroken > 0 && chunkTier === 'fever' ? 1 : 0;

    return {
        cursedMatchedEarlyThisFloor: run.cursedMatchedEarlyThisFloor || cursedMatchedEarly,
        matchResolutionsThisFloor: runNonNegativeInteger(run.matchResolutionsThisFloor) + 1,
        findablesClaimedThisFloor: runNonNegativeInteger(run.findablesClaimedThisFloor) + safeFindablesClaimedDelta,
        safeHazardWardChargesThisFloor: Math.min(
            1,
            runNonNegativeInteger(run.safeHazardWardChargesThisFloor) + safeFindableWardGain
        ),
        chunkBreaksThisFloor: runNonNegativeInteger(run.chunkBreaksThisFloor) + (safePairsBroken > 0 ? 1 : 0),
        chunkPairsBrokenThisFloor: runNonNegativeInteger(run.chunkPairsBrokenThisFloor) + safePairsBroken,
        chunkScoreThisFloor: runNonNegativeInteger(run.chunkScoreThisFloor) + runNonNegativeInteger(chunkScore),
        chunkPairsThisChain: runNonNegativeInteger(run.chunkPairsThisChain) + runNonNegativeInteger(chunkMomentumPairs),
        feverBreaksThisFloor: runNonNegativeInteger(run.feverBreaksThisFloor) + feverBreak,
        bestChainThisFloor: Math.max(runNonNegativeInteger(run.bestChainThisFloor), runNonNegativeInteger(chainAfter)),
        feverBreaksThisRun: runNonNegativeInteger(run.feverBreaksThisRun) + feverBreak,
        biggestChunkPairs: Math.max(runNonNegativeInteger(run.biggestChunkPairs), safePairsBroken),
        bestChainThisRun: Math.max(runNonNegativeInteger(run.bestChainThisRun), runNonNegativeInteger(chainAfter)),
        chunkPairsDroppedThisFloor: runNonNegativeInteger(run.chunkPairsDroppedThisFloor) + runNonNegativeInteger(chunkDroppedPairs),
        chunkDropsThisRun: runNonNegativeInteger(run.chunkDropsThisRun) + (runNonNegativeInteger(chunkDroppedPairs) > 0 ? 1 : 0),
        bestRippleThisFloor: Math.max(runNonNegativeInteger(run.bestRippleThisFloor), runNonNegativeInteger(chunkRippleWaves)),
        bestRippleThisRun: Math.max(runNonNegativeInteger(run.bestRippleThisRun), runNonNegativeInteger(chunkRippleWaves)),
        anchorSealChargesThisFloor: decrementRunCounter(run.anchorSealChargesThisFloor, anchorSealUsed ? 1 : 0),
        anchorSealUsesThisFloor: runNonNegativeInteger(run.anchorSealUsesThisFloor) + (anchorSealUsed ? 1 : 0)
    };
};
