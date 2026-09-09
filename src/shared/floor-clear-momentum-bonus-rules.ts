import { chainMomentum, getChainTier, type ChainTier } from './chain-tier-rules';

/**
 * Extreme Fever: the tier the momentum still holds when the last pair goes.
 *
 * Peggle stops on the last orange peg and pays out bonus buckets the player did nothing extra to
 * earn; the finish is the biggest firework and it is free. Here the last pair resolves with the
 * chain still up, and the tier that chain holds on this floor multiplies the floor-end bonus
 * (Gen 181, thesis §40.5: cold 1, Clean 1.5, Sharp 2.5, Fever 5) and names the finish. Never
 * rating: that stays what memory earned.
 *
 * It paid a gold until Gen 174 and a combo shard until Gen 184; both currencies are gone, and the
 * reading is what remains.
 */
export const EXTREME_FEVER_BONUS_TAG = 'extreme_fever';

export interface FloorClearMomentumBonus {
    momentum: number;
    tier: ChainTier;
}

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
    return { momentum, tier: getChainTier(momentum, pairsOnFloor) };
};
