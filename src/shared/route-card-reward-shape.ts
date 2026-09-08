/**
 * What a matched route card used to pay, and nothing that decides it.
 *
 * `route-card-reward-rules.ts` went with the route layer in Gen 173: it read a tile's route special
 * or route card kind and turned it into score, gold, guard, a ward charge, a combo shard or relic
 * favor. Generation deals no such tile, so the whole decision is gone and only the shape is left.
 *
 * The shape stays because the turn's reward record is a fixed set of fields that several callers
 * read and one of them writes zeros. Collapsing it away is Phase 2's job, when scoring is rewritten
 * multiplicatively (§40.2) and this record is replaced rather than emptied.
 */
export interface RouteCardReward {
    score: number;
    shopGold: number;
    guardTokens: number;
    safeHazardWardCharges: number;
    comboShards: number;
    relicFavor: number;
}

export const emptyRouteCardReward = (): RouteCardReward => ({
    score: 0,
    shopGold: 0,
    guardTokens: 0,
    safeHazardWardCharges: 0,
    comboShards: 0,
    relicFavor: 0
});
