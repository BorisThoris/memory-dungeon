import { describe, expect, it } from 'vitest';
import type { BoardState, RunState } from './contracts';
import { MAX_COMBO_SHARDS } from './contracts';
import { createNewRun, finalizeLevel, finishMemorizePhase } from './game';
import {
    applyMomentumBonusShards,
    EXTREME_FEVER_BONUS_TAG,
    getFloorClearMomentumBonus,
    MOMENTUM_BONUS_BY_TIER
} from './floor-clear-momentum-bonus-rules';

describe('the momentum bonus ladder', () => {
    it('pays by the tier the momentum holds on this floor, and nothing below Clean', () => {
        // Twelve pairs: Sharp from 5, Fever from 8.
        // Gold left the ladder with the shop (Gen 174): Clean and Sharp name the tier and pay
        // nothing until Phase 2's floor-end bonus pays them in score; Fever still pays the shard.
        expect(getFloorClearMomentumBonus({ chain: 2, cascadedPairs: 0, pairsOnFloor: 12 })).toMatchObject({ tier: 'none', shards: 0 });
        expect(getFloorClearMomentumBonus({ chain: 3, cascadedPairs: 0, pairsOnFloor: 12 })).toMatchObject({ tier: 'clean', shards: 0 });
        expect(getFloorClearMomentumBonus({ chain: 3, cascadedPairs: 2, pairsOnFloor: 12 })).toMatchObject({ momentum: 5, tier: 'sharp', shards: 0 });
        expect(getFloorClearMomentumBonus({ chain: 5, cascadedPairs: 3, pairsOnFloor: 12 })).toMatchObject({ momentum: 8, tier: 'fever', shards: 1 });
        expect(MOMENTUM_BONUS_BY_TIER.fever.shards).toBe(1);
    });

    it('never pushes shards past the cap', () => {
        const fever = getFloorClearMomentumBonus({ chain: 8, cascadedPairs: 0, pairsOnFloor: 12 });
        expect(applyMomentumBonusShards(MAX_COMBO_SHARDS, fever)).toBe(MAX_COMBO_SHARDS);
        expect(applyMomentumBonusShards(0, fever)).toBe(1);
    });
});

describe('Extreme Fever at the floor clear', () => {
    const clearedRun = (chain: number, cascadedPairs: number): { run: RunState; board: BoardState } => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 4242 }));
        const board: BoardState = {
            ...base.board!,
            pairCount: 12,
            matchedPairs: 12,
            dungeonExitTileId: null,
            dungeonExitActivated: false,
            tiles: base.board!.tiles.map((tile) => ({ ...tile, state: 'matched' as const }))
        };
        const run: RunState = {
            ...base,
            board,
            chunkPairsThisChain: cascadedPairs,
            chunkBreaksThisFloor: 2,
            chunkPairsBrokenThisFloor: cascadedPairs,
            feverBreaksThisFloor: 1,
            bestChainThisFloor: chain,
            stats: { ...base.stats, currentStreak: chain, comboShards: 0 }
        };
        return { run, board };
    };

    it('pays the standing momentum in a shard, tags the result, and writes the chain recap', () => {
        const { run, board } = clearedRun(5, 3);
        const cleared = finalizeLevel(run, board);
        expect(cleared.status).toBe('levelComplete');
        expect(cleared.lastLevelResult?.momentumBonusTier).toBe('fever');
        expect(cleared.lastLevelResult?.chainMomentumAtClear).toBe(8);
        expect(cleared.lastLevelResult?.momentumBonusShards).toBe(1);
        expect(cleared.lastLevelResult?.bonusTags).toContain(EXTREME_FEVER_BONUS_TAG);
        expect(cleared.lastLevelResult?.chunkBreaks).toBe(2);
        expect(cleared.lastLevelResult?.chunkPairsBroken).toBe(3);
        expect(cleared.lastLevelResult?.feverBreaks).toBe(1);
        expect(cleared.lastLevelResult?.bestChain).toBe(5);
        expect(cleared.stats.comboShards).toBe(1);
        // No gold: the wallet is closed (Gen 174), whatever the floor's momentum.
        expect(cleared.shopGold).toBe(0);
    });

    it('pays nothing when the chain dropped before the last pair, and the score is untouched either way', () => {
        const { run, board } = clearedRun(1, 0);
        const cleared = finalizeLevel(run, board);
        expect(cleared.lastLevelResult?.momentumBonusTier).toBeUndefined();
        expect(cleared.lastLevelResult?.bonusTags ?? []).not.toContain(EXTREME_FEVER_BONUS_TAG);
        expect(cleared.stats.comboShards).toBe(0);
        const fever = finalizeLevel(clearedRun(5, 3).run, board);
        expect(fever.lastLevelResult?.scoreGained).toBe(cleared.lastLevelResult?.scoreGained);
        expect(fever.lastLevelResult?.rating).toBe(cleared.lastLevelResult?.rating);
    });
});
