import type { RelicId, RunShopItemId, StartingLoadoutId, TileTraitKind } from './contracts';

export interface TraitBuildRewardRow {
    id: string;
    label: string;
    traitKinds: TileTraitKind[];
    relicIds: RelicId[];
    shopItemIds: RunShopItemId[];
    decision: string;
    payoff: string;
    regressionHook: string;
}

export const TRAIT_BUILD_REWARD_ROWS: readonly TraitBuildRewardRow[] = [
    {
        id: 'conduit_cartographer',
        label: 'Conduit Cartographer',
        traitKinds: ['conduit', 'echo', 'mirror'],
        relicIds: ['chapter_compass', 'peek_charge_plus_one'],
        shopItemIds: ['peek_charge', 'region_shuffle_charge', 'trait_routing_kit'],
        decision: 'Move or route Conduit beside readable traits before committing the match.',
        payoff: 'Extra score, peek charge value, and Chapter Compass mapping payoff.',
        regressionHook: 'trait-build:conduit-cartographer'
    },
    {
        id: 'sealed_catalyst',
        label: 'Sealed Catalyst',
        traitKinds: ['sealed', 'echo', 'heavy'],
        relicIds: ['combo_shard_plus_step'],
        shopItemIds: ['region_shuffle_charge', 'peek_charge', 'trait_routing_kit'],
        decision: 'Build Echo or Heavy adjacency around Sealed instead of treating it as a plain penalty tile.',
        payoff: 'Combo shards, capped-shard score overflow, and heavy score spikes.',
        regressionHook: 'trait-build:sealed-catalyst'
    },
    {
        id: 'drift_routing',
        label: 'Drift Routing',
        traitKinds: ['drift', 'volatile'],
        relicIds: ['region_shuffle_free_first', 'first_shuffle_free_per_floor'],
        shopItemIds: ['region_shuffle_charge', 'trait_routing_kit'],
        decision: 'Use Drift matches to keep repositioning tools flowing through the floor.',
        payoff: 'More row/swap charges, with Volatile adjacency adding full shuffle reach.',
        regressionHook: 'trait-build:drift-routing'
    },
    {
        id: 'mirror_warden',
        label: 'Mirror Warden',
        traitKinds: ['mirror', 'stasis'],
        relicIds: ['guard_token_plus_one', 'memorize_bonus_ms'],
        shopItemIds: ['heal_life', 'region_shuffle_charge', 'trait_routing_kit'],
        decision: 'Route Mirror near Stasis when the floor has enough remaining pairs to exploit the block.',
        payoff: 'Guard, capped-guard score, and safer next-turn openings.',
        regressionHook: 'trait-build:mirror-warden'
    },
    {
        id: 'cursed_greed',
        label: 'Cursed Greed',
        traitKinds: ['cursed', 'volatile', 'stasis'],
        relicIds: ['parasite_ledger', 'wager_surety', 'shrine_echo'],
        shopItemIds: ['heal_life', 'region_shuffle_charge', 'trait_routing_kit', 'iron_key'],
        decision: 'Accept Cursed plus Volatile upside when Stasis or Wager Surety can buffer the miss cost.',
        payoff: 'Gold, score, Favor, and softened risky-cluster miss pressure.',
        regressionHook: 'trait-build:cursed-greed'
    }
] as const;

export const getTraitBuildRewardRows = (): TraitBuildRewardRow[] =>
    TRAIT_BUILD_REWARD_ROWS.map((row) => ({
        ...row,
        traitKinds: [...row.traitKinds],
        relicIds: [...row.relicIds],
        shopItemIds: [...row.shopItemIds]
    }));

export const getTraitBuildRewardRowsForTrait = (traitKind: TileTraitKind): TraitBuildRewardRow[] =>
    getTraitBuildRewardRows().filter((row) => row.traitKinds.includes(traitKind));

export const getTraitBuildRewardRowsForRelic = (relicId: RelicId): TraitBuildRewardRow[] =>
    getTraitBuildRewardRows().filter((row) => row.relicIds.includes(relicId));

const LOADOUT_TRAIT_BUILD_IDS: Record<StartingLoadoutId, string[]> = {
    memory_scout: ['conduit_cartographer', 'sealed_catalyst'],
    route_tactician: ['drift_routing', 'conduit_cartographer'],
    cursebreaker: ['mirror_warden', 'cursed_greed'],
    vaultbreaker: ['cursed_greed', 'sealed_catalyst']
};

export const getTraitBuildRewardRowsForLoadout = (
    startingLoadoutId: StartingLoadoutId | null | undefined
): TraitBuildRewardRow[] => {
    if (!startingLoadoutId) {
        return [];
    }
    const ids = LOADOUT_TRAIT_BUILD_IDS[startingLoadoutId] ?? [];
    return getTraitBuildRewardRows().filter((row) => ids.includes(row.id));
};

export const getTraitBuildDraftHintForRelic = (relicId: RelicId): string | null => {
    const rows = getTraitBuildRewardRowsForRelic(relicId);
    if (rows.length === 0) {
        return null;
    }
    const labels = rows.map((row) => row.label).slice(0, 2);
    return `Trait build: ${labels.join(' / ')}`;
};
