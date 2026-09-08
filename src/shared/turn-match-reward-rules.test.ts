import { describe, expect, it } from 'vitest';

import { MAX_GUARD_TOKENS, type RunState } from './contracts';
import { createNewRun } from './run-creation-rules';
import { calculateResolvedMatchSurvivalReward } from './turn-match-reward-rules';

const run = (overrides: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 22_001 }),
    gameMode: 'endless',
    lives: 4,
    stats: {
        ...createNewRun(0, { runSeed: 22_002 }).stats,
        comboShards: 0,
        guardTokens: 0
    },
    ...overrides
});

describe('turn match reward rules', () => {
    it('awards streak guard tokens and combo shards on normal runs', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 4,
            findableComboShardGain: 0,
            run: run()
        });

        expect(reward.guardTokens).toBe(1);
        expect(reward.comboShards).toBe(1);
        expect(reward.lives).toBe(4);
    });

    it('caps guard token rewards', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 4,
            findableComboShardGain: 0,
            run: run({ stats: { ...run().stats, guardTokens: MAX_GUARD_TOKENS } })
        });

        expect(reward.guardTokens).toBe(MAX_GUARD_TOKENS);
    });

    it('normalizes malformed survival reward counters before cap and conversion checks', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: Number.NaN,
            findableComboShardGain: 1.9,
            run: run({
                lives: 2.9,
                stats: {
                    ...run().stats,
                    comboShards: Number.POSITIVE_INFINITY,
                    guardTokens: Number.NaN
                }
            })
        });

        expect(reward.guardTokens).toBe(0);
        expect(reward.comboShards).toBe(1);
        expect(reward.lives).toBe(2);
    });

    it('normalizes malformed stat records before cap and conversion checks', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 4,
            findableComboShardGain: 1,
            run: run({ stats: Number.NaN as unknown as RunState['stats'] })
        });

        expect(reward.guardTokens).toBe(1);
        expect(reward.comboShards).toBe(2);
        expect(reward.lives).toBe(4);
    });
});
