import { describe, expect, it } from 'vitest';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchProgress } from './turn-match-progress-rules';

const baseInput = (run = createNewRun(0)) => ({
    run,
    cursedMatchedEarly: false,
    findablesClaimedDelta: 0,
    findableSafeHazardWardGain: 0,
    chunkPairsBroken: 0,
    chunkScore: 0,
    chunkTier: 'none' as const,
    chainAfter: 0,
    chunkDroppedPairs: 0,
    chunkMomentumPairs: 0,
    chunkRippleWaves: 0,
    anchorSealUsed: false
});

describe('resolveTurnMatchProgress', () => {
    it('increments match and findable counters and caps the findable ward at one', () => {
        const run = {
            ...createNewRun(0),
            matchResolutionsThisFloor: 2,
            findablesClaimedThisFloor: 1,
            safeHazardWardChargesThisFloor: 0
        };

        const result = resolveTurnMatchProgress({
            ...baseInput(run),
            cursedMatchedEarly: true,
            findablesClaimedDelta: 2,
            findableSafeHazardWardGain: 1
        });

        expect(result.cursedMatchedEarlyThisFloor).toBe(true);
        expect(result.matchResolutionsThisFloor).toBe(3);
        expect(result.findablesClaimedThisFloor).toBe(3);
        expect(result.safeHazardWardChargesThisFloor).toBe(1);
        expect(resolveTurnMatchProgress({ ...baseInput(run), findableSafeHazardWardGain: 3 }).safeHazardWardChargesThisFloor).toBe(1);
    });

    it('spends an anchor seal charge on the turn the spotlight held', () => {
        const run = { ...createNewRun(0), anchorSealChargesThisFloor: 1, anchorSealUsesThisFloor: 2 };

        const result = resolveTurnMatchProgress({ ...baseInput(run), anchorSealUsed: true });

        expect(result.anchorSealChargesThisFloor).toBe(0);
        expect(result.anchorSealUsesThisFloor).toBe(3);
    });

    it('does not let anchor charges go below zero', () => {
        const result = resolveTurnMatchProgress({
            ...baseInput({ ...createNewRun(0), anchorSealChargesThisFloor: 0 }),
            anchorSealUsed: true
        });

        expect(result.anchorSealChargesThisFloor).toBe(0);
    });

    it('normalizes malformed persisted counters and match progress deltas', () => {
        const run = {
            ...createNewRun(0),
            matchResolutionsThisFloor: Number.NaN,
            findablesClaimedThisFloor: -2,
            safeHazardWardChargesThisFloor: Number.POSITIVE_INFINITY,
            anchorSealChargesThisFloor: Number.NaN,
            anchorSealUsesThisFloor: -2,
            chunkBreaksThisFloor: Number.NaN,
            chunkPairsBrokenThisFloor: Number.POSITIVE_INFINITY,
            chunkScoreThisFloor: -3,
            chunkPairsThisChain: 1.9,
            bestChainThisFloor: Number.NaN,
            bestRippleThisFloor: -1
        };

        const result = resolveTurnMatchProgress({
            ...baseInput(run),
            findablesClaimedDelta: 2.9,
            findableSafeHazardWardGain: 1.9,
            chunkPairsBroken: 2.9,
            chunkScore: 10.5,
            chunkMomentumPairs: 1.5,
            chunkRippleWaves: 2.2,
            chainAfter: 3.7,
            anchorSealUsed: true
        });

        expect(result.matchResolutionsThisFloor).toBe(1);
        expect(result.findablesClaimedThisFloor).toBe(2);
        expect(result.safeHazardWardChargesThisFloor).toBe(1);
        expect(result.anchorSealChargesThisFloor).toBe(0);
        expect(result.anchorSealUsesThisFloor).toBe(1);
        expect(result.chunkBreaksThisFloor).toBe(1);
        expect(result.chunkPairsBrokenThisFloor).toBe(2);
        expect(result.chunkScoreThisFloor).toBe(10);
        expect(result.chunkPairsThisChain).toBe(2);
        expect(result.bestChainThisFloor).toBe(3);
        expect(result.bestRippleThisFloor).toBe(2);
    });
});

describe("the chain's floor", () => {
    it('counts a Fever break and keeps the longest chain the floor saw', () => {
        const first = resolveTurnMatchProgress({ ...baseInput(), chunkPairsBroken: 3, chunkTier: 'fever', chainAfter: 6 });
        expect(first.feverBreaksThisFloor).toBe(1);
        expect(first.bestChainThisFloor).toBe(6);
        // A Sharp break is not a Fever break, and a shorter chain does not lower the best.
        const run = { ...createNewRun(0), feverBreaksThisFloor: 1, bestChainThisFloor: 6 };
        const second = resolveTurnMatchProgress({ ...baseInput(run), chunkPairsBroken: 2, chunkTier: 'sharp', chainAfter: 2 });
        expect(second.feverBreaksThisFloor).toBe(1);
        expect(second.bestChainThisFloor).toBe(6);
        // Fever tier with nothing broken is a tier, not a break.
        const third = resolveTurnMatchProgress({ ...baseInput(run), chunkPairsBroken: 0, chunkTier: 'fever', chainAfter: 9 });
        expect(third.feverBreaksThisFloor).toBe(1);
        expect(third.bestChainThisFloor).toBe(9);
    });

    it('counts the drop and the ripple', () => {
        const result = resolveTurnMatchProgress({
            ...baseInput(),
            chunkPairsBroken: 3,
            chunkTier: 'sharp',
            chainAfter: 4,
            chunkDroppedPairs: 1,
            chunkRippleWaves: 3
        });
        expect(result).toMatchObject({
            chunkPairsDroppedThisFloor: 1,
            chunkDropsThisRun: 1,
            bestRippleThisFloor: 3,
            bestRippleThisRun: 3
        });
    });
});

describe('the run-wide chain records', () => {
    it('keep the biggest chunk and count Fever breaks across floors', () => {
        const first = resolveTurnMatchProgress({ ...baseInput(), chunkPairsBroken: 4, chunkTier: 'fever', chainAfter: 5 });
        expect(first).toMatchObject({ biggestChunkPairs: 4, feverBreaksThisRun: 1, bestChainThisRun: 5 });
        const run = { ...createNewRun(0), biggestChunkPairs: 4, feverBreaksThisRun: 1, bestChainThisRun: 5 };
        const second = resolveTurnMatchProgress({ ...baseInput(run), chunkPairsBroken: 2, chunkTier: 'sharp', chainAfter: 3 });
        expect(second).toMatchObject({ biggestChunkPairs: 4, feverBreaksThisRun: 1, bestChainThisRun: 5 });
    });
});
