import { describe, expect, it } from 'vitest';
import type { BoardState, RunState } from './contracts';
import { createNewRun, finalizeLevel, finishMemorizePhase } from './game';
import { FLOOR_CLEAR_BASE_PER_LEVEL } from './level-clear-rules';
import { EXTREME_FEVER_BONUS_TAG, getFloorClearMomentumBonus } from './floor-clear-momentum-bonus-rules';

describe('the momentum bonus ladder', () => {
    it('names the tier the momentum holds on this floor, and nothing below Clean', () => {
        // Twelve pairs: Sharp from 6, Fever from 8. The ladder pays nothing itself any more: gold
        // left with the shop (Gen 174) and the shard with the life economy (Gen 184). The tier it
        // names multiplies the floor-end bonus (Gen 181).
        expect(getFloorClearMomentumBonus({ chain: 2, cascadedPairs: 0, pairsOnFloor: 12 })).toEqual({ momentum: 2, tier: 'none' });
        expect(getFloorClearMomentumBonus({ chain: 3, cascadedPairs: 0, pairsOnFloor: 12 })).toEqual({ momentum: 3, tier: 'clean' });
        expect(getFloorClearMomentumBonus({ chain: 3, cascadedPairs: 2, pairsOnFloor: 12 })).toEqual({ momentum: 5, tier: 'clean' });
        expect(getFloorClearMomentumBonus({ chain: 4, cascadedPairs: 2, pairsOnFloor: 12 })).toEqual({ momentum: 6, tier: 'sharp' });
        expect(getFloorClearMomentumBonus({ chain: 5, cascadedPairs: 3, pairsOnFloor: 12 })).toEqual({ momentum: 8, tier: 'fever' });
    });
});

describe('Extreme Fever at the floor clear', () => {
    const clearedRun = (chain: number, cascadedPairs: number): { run: RunState; board: BoardState } => {
        const base = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 4242 }));
        const board: BoardState = {
            ...base.board!,
            pairCount: 12,
            matchedPairs: 12,
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
            stats: { ...base.stats, currentStreak: chain }
        };
        return { run, board };
    };

    it('names the standing momentum tier, tags the result, and writes the chain recap', () => {
        const { run, board } = clearedRun(5, 3);
        const cleared = finalizeLevel(run, board);
        expect(cleared.status).toBe('levelComplete');
        expect(cleared.lastLevelResult?.momentumBonusTier).toBe('fever');
        expect(cleared.lastLevelResult?.chainMomentumAtClear).toBe(8);
        expect(cleared.lastLevelResult?.bonusTags).toContain(EXTREME_FEVER_BONUS_TAG);
        expect(cleared.lastLevelResult?.chunkBreaks).toBe(2);
        expect(cleared.lastLevelResult?.chunkPairsBroken).toBe(3);
        expect(cleared.lastLevelResult?.feverBreaks).toBe(1);
        expect(cleared.lastLevelResult?.bestChain).toBe(5);
    });

    it('pays nothing when the chain dropped before the last pair; a Fever finish multiplies the floor bonus and never the rating', () => {
        const { run, board } = clearedRun(1, 0);
        const cleared = finalizeLevel(run, board);
        expect(cleared.lastLevelResult?.momentumBonusTier).toBeUndefined();
        expect(cleared.lastLevelResult?.bonusTags ?? []).not.toContain(EXTREME_FEVER_BONUS_TAG);
        expect(cleared.lastLevelResult?.floorBonusTierMult).toBe(1);
        const fever = finalizeLevel(clearedRun(5, 3).run, board);
        // Gen 181: the tier still standing multiplies the floor-end bonus (thesis §40.5), five times cold at Fever.
        expect(fever.lastLevelResult?.floorBonusTierMult).toBe(5);
        const base = FLOOR_CLEAR_BASE_PER_LEVEL * board.level;
        expect((fever.lastLevelResult?.floorBonus ?? 0) - (cleared.lastLevelResult?.floorBonus ?? 0)).toBe(base * 4);
        expect((fever.lastLevelResult?.scoreGained ?? 0) - (cleared.lastLevelResult?.scoreGained ?? 0)).toBe(base * 4);
        expect(fever.lastLevelResult?.floorEfficiencyBonus).toBe(cleared.lastLevelResult?.floorEfficiencyBonus);
        expect(fever.lastLevelResult?.rating).toBe(cleared.lastLevelResult?.rating);
    });
});
