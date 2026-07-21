import {
    MAX_COMBO_SHARDS,
    MAX_GUARD_TOKENS,
    type RelicId,
    type RunState
} from './contracts';
import { normalizeSessionStats } from './session-stats-rules';

const nonNegativeFiniteInteger = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

/** Increment extra selections for the next milestone draft (consumed in `openRelicOffer`). */
export const grantBonusRelicPickNextOffer = (run: RunState, amount: number = 1): RunState => ({
    ...run,
    bonusRelicPicksNextOffer:
        nonNegativeFiniteInteger(run.bonusRelicPicksNextOffer) + nonNegativeFiniteInteger(amount)
});

export const applyRelicImmediate = (run: RunState, relicId: RelicId): RunState => {
    const stats = normalizeSessionStats(run.stats);
    switch (relicId) {
        case 'extra_shuffle_charge':
            return { ...run, shuffleCharges: nonNegativeFiniteInteger(run.shuffleCharges) + 1 };
        case 'destroy_bank_plus_one':
            return {
                ...run,
                destroyPairCharges: nonNegativeFiniteInteger(run.destroyPairCharges) + 1
            };
        case 'first_shuffle_free_per_floor':
            return { ...run, freeShuffleThisFloor: true };
        case 'combo_shard_plus_step':
            return {
                ...run,
                stats: { ...stats, comboShards: Math.min(MAX_COMBO_SHARDS, nonNegativeFiniteInteger(stats.comboShards) + 1) }
            };
        case 'memorize_under_short_memorize':
            return run;
        case 'parasite_ward_once':
            return { ...run, parasiteWardRemaining: nonNegativeFiniteInteger(run.parasiteWardRemaining) + 1 };
        case 'region_shuffle_free_first':
            return run;
        case 'peek_charge_plus_one':
            return { ...run, peekCharges: nonNegativeFiniteInteger(run.peekCharges) + 1 };
        case 'stray_charge_plus_one':
            return { ...run, strayRemoveCharges: nonNegativeFiniteInteger(run.strayRemoveCharges) + 1 };
        case 'pin_cap_plus_one':
            return run;
        case 'guard_token_plus_one':
            return {
                ...run,
                stats: {
                    ...stats,
                    guardTokens: Math.min(MAX_GUARD_TOKENS, nonNegativeFiniteInteger(stats.guardTokens) + 1)
                }
            };
        case 'shrine_echo':
            return grantBonusRelicPickNextOffer(run, 1);
        case 'chapter_compass':
            return { ...run, peekCharges: nonNegativeFiniteInteger(run.peekCharges) + 1 };
        case 'wager_surety':
            return {
                ...run,
                stats: {
                    ...stats,
                    guardTokens: Math.min(MAX_GUARD_TOKENS, nonNegativeFiniteInteger(stats.guardTokens) + 1)
                }
            };
        case 'parasite_ledger':
            return { ...run, parasiteWardRemaining: nonNegativeFiniteInteger(run.parasiteWardRemaining) + 1 };
        default:
            return run;
    }
};
