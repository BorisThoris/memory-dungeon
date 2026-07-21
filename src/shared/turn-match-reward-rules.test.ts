import { describe, expect, it } from 'vitest';

import { MAX_GUARD_TOKENS, type RunState } from './contracts';
import { createNewRun } from './run-creation-rules';
import { calculateResolvedMatchSurvivalReward } from './turn-match-reward-rules';

const emptyReward = { comboShards: 0, guardTokens: 0 };

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
            catalystAltarUpgraded: false,
            currentStreak: 4,
            dungeonReward: emptyReward,
            findableComboShardGain: 0,
            mimicCacheBite: false,
            mimicCacheFatalBite: false,
            mimicCacheGuardBite: false,
            routeCardReward: emptyReward,
            run: run()
        });

        expect(reward.guardTokens).toBe(1);
        expect(reward.comboShards).toBe(1);
        expect(reward.lives).toBe(4);
    });

    it('caps guard token rewards', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded: false,
            currentStreak: 4,
            dungeonReward: { comboShards: 0, guardTokens: 2 },
            findableComboShardGain: 0,
            mimicCacheBite: false,
            mimicCacheFatalBite: false,
            mimicCacheGuardBite: false,
            routeCardReward: { comboShards: 0, guardTokens: 2 },
            run: run({ stats: { ...run().stats, guardTokens: MAX_GUARD_TOKENS } })
        });

        expect(reward.guardTokens).toBe(MAX_GUARD_TOKENS);
    });

    it('normalizes malformed survival reward counters before cap and conversion checks', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded: false,
            currentStreak: Number.NaN,
            dungeonReward: { comboShards: Number.NaN, guardTokens: Number.POSITIVE_INFINITY },
            findableComboShardGain: 1.9,
            mimicCacheBite: false,
            mimicCacheFatalBite: false,
            mimicCacheGuardBite: false,
            routeCardReward: { comboShards: 2.9, guardTokens: 1.9 },
            run: run({
                lives: 2.9,
                stats: {
                    ...run().stats,
                    comboShards: Number.POSITIVE_INFINITY,
                    guardTokens: Number.NaN
                }
            })
        });

        expect(reward.guardTokens).toBe(1);
        expect(reward.comboShards).toBe(0);
        expect(reward.lives).toBe(3);
    });

    it('normalizes malformed stat records before cap and conversion checks', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded: false,
            currentStreak: 4,
            dungeonReward: emptyReward,
            findableComboShardGain: 1,
            mimicCacheBite: false,
            mimicCacheFatalBite: false,
            mimicCacheGuardBite: false,
            routeCardReward: emptyReward,
            run: run({ stats: Number.NaN as unknown as RunState['stats'] })
        });

        expect(reward.guardTokens).toBe(1);
        expect(reward.comboShards).toBe(2);
        expect(reward.lives).toBe(4);
    });

    it('does not award streak combo or guard bonuses in meditation', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded: false,
            currentStreak: 4,
            dungeonReward: emptyReward,
            findableComboShardGain: 0,
            mimicCacheBite: false,
            mimicCacheFatalBite: false,
            mimicCacheGuardBite: false,
            routeCardReward: emptyReward,
            run: run({ gameMode: 'meditation' })
        });

        expect(reward.guardTokens).toBe(0);
        expect(reward.comboShards).toBe(0);
    });

    it('sets lives to zero on fatal mimic bites', () => {
        const reward = calculateResolvedMatchSurvivalReward({
            catalystAltarUpgraded: false,
            currentStreak: 2,
            dungeonReward: emptyReward,
            findableComboShardGain: 0,
            mimicCacheBite: true,
            mimicCacheFatalBite: true,
            mimicCacheGuardBite: false,
            routeCardReward: emptyReward,
            run: run({ lives: 1 })
        });

        expect(reward.lives).toBe(0);
    });
});
