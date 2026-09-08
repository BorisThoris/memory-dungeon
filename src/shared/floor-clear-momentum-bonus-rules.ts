import { MAX_COMBO_SHARDS } from './contracts';
import { chainMomentum, getChainTier, type ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Extreme Fever: what the floor's end pays for the momentum still standing.
 *
 * Peggle stops on the last orange peg and pays out bonus buckets the player did nothing extra to
 * earn; the finish is the biggest firework and it is free. Here the last pair resolves with the
 * chain still up, and the tier that chain holds on this floor pays a small ladder. Never rating,
 * never score: those stay what memory earned.
 *
 * Gen 174: the ladder used to pay a gold at Clean and Sharp and two at Fever, and gold is gone
 * with the shop it was for. Until Phase 2's floor-end bonus (T2.7) pays the tiers in score, only
 * Fever pays anything - the shard - and Clean and Sharp are a name on the floor-clear line.
 */
export const EXTREME_FEVER_BONUS_TAG = 'extreme_fever';

export interface FloorClearMomentumBonus {
    momentum: number;
    tier: ChainTier;
    shards: number;
}

export const MOMENTUM_BONUS_BY_TIER: Record<ChainTier, { shards: number }> = {
    none: { shards: 0 },
    clean: { shards: 0 },
    sharp: { shards: 0 },
    fever: { shards: 1 }
};

export const getFloorClearMomentumBonus = ({
    chain,
    cascadedPairs,
    pairsOnFloor
}: {
    chain: number;
    cascadedPairs: number;
    pairsOnFloor: number | null | undefined;
}): FloorClearMomentumBonus => {
    const momentum = chainMomentum(chain, cascadedPairs);
    const tier = getChainTier(momentum, pairsOnFloor);
    return { momentum, tier, ...MOMENTUM_BONUS_BY_TIER[tier] };
};

/** Shards after the bonus, never past the cap: a full pocket wastes the shard, and says so. */
export const applyMomentumBonusShards = (comboShards: number, bonus: FloorClearMomentumBonus): number =>
    Math.min(MAX_COMBO_SHARDS, runNonNegativeInteger(comboShards) + runNonNegativeInteger(bonus.shards));
