import { MAX_COMBO_SHARDS } from './contracts';
import { chainMomentum, getChainTier, type ChainTier } from './chain-tier-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Extreme Fever: what the floor's end pays for the momentum still standing.
 *
 * Peggle stops on the last orange peg and pays out bonus buckets the player did nothing extra to
 * earn; the finish is the biggest firework and it is free. Here the last pair resolves with the
 * chain still up, and the tier that chain holds on this floor pays a small ladder — gold and, at
 * Fever, a shard. Never rating, never score: those stay what memory earned.
 */
export const EXTREME_FEVER_BONUS_TAG = 'extreme_fever';

export interface FloorClearMomentumBonus {
    momentum: number;
    tier: ChainTier;
    shards: number;
    gold: number;
}

export const MOMENTUM_BONUS_BY_TIER: Record<ChainTier, { shards: number; gold: number }> = {
    none: { shards: 0, gold: 0 },
    // A floor pays three to eight gold on its own and the vendor's cards cost two to five, so the
    // ladder stays a tip, not a wage: measured on 6 seeds x 24 floors, a clean player finishes at
    // Fever on three floors in four and a 25%-miss player on one in five.
    clean: { shards: 0, gold: 1 },
    sharp: { shards: 0, gold: 1 },
    fever: { shards: 1, gold: 2 }
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
