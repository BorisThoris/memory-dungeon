import { describe, expect, it } from 'vitest';

import { MAX_COMBO_SHARDS, type RunState } from './contracts';
import { createNewRun } from './run-creation-rules';
import { calculateResolvedMatchSurvivalReward } from './turn-match-reward-rules';

const run = (overrides: Partial<RunState> = {}): RunState => ({
    ...createNewRun(0, { runSeed: 22_001 }),
    gameMode: 'endless',
    stats: {
        ...createNewRun(0, { runSeed: 22_002 }).stats,
        comboShards: 0
    },
    ...overrides
});

describe('turn match reward rules', () => {
    it('banks a combo shard on every second step of the streak', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 4,
            findableComboShardGain: 0,
            run: run()
        });

        expect(reward).toEqual({ comboShards: 1 });
    });

    it('banks nothing off the streak cadence', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 3,
            findableComboShardGain: 0,
            run: run()
        });

        expect(reward.comboShards).toBe(0);
    });

    it('caps the shard bank', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 4,
            findableComboShardGain: 3,
            run: run({ stats: { ...run().stats, comboShards: MAX_COMBO_SHARDS } })
        });

        expect(reward.comboShards).toBe(MAX_COMBO_SHARDS);
    });

    it('normalizes malformed survival reward counters before the cap', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: Number.NaN,
            findableComboShardGain: 1.9,
            run: run({
                stats: {
                    ...run().stats,
                    comboShards: Number.POSITIVE_INFINITY
                }
            })
        });

        expect(reward.comboShards).toBe(1);
    });

    it('normalizes malformed stat records before the cap', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            currentStreak: 4,
            findableComboShardGain: 1,
            run: run({ stats: Number.NaN as unknown as RunState['stats'] })
        });

        expect(reward.comboShards).toBe(2);
    });
});
