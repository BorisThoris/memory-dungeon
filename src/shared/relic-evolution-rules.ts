import type { RunState } from './contracts';
import type { BlueprintId } from './boss-reward-rules';
import { hasRelic, relicRank, CAMP_UPGRADE_MAX_RANK, type CampUpgradeId } from './run-relic-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Relic evolutions (DGE-014, rules 77): power from combinations, the build ceiling's answer.
 *
 * A relic at rank 3 held beside its partner at rank 3, with the boss's blueprint for it (`boss-reward-
 * rules.ts`), is offered its evolution at the next camp, once, for `EVOLUTION_PRICE` gold. The camp
 * spends on its own (`automatic-camp-rules.ts`): it buys an evolution it can afford before anything
 * else; one it cannot afford at that camp is gone for the run. The evolution takes the slot of its
 * first ingredient - the ingredient stays, its ranks still working, but it can be the first of no
 * other evolution - so evolving never costs a slot (`relic-slots`, DGE-013).
 *
 * The six (`tasks/deep-game-epic/02-deep-game-plan.md` §4):
 * - **Lantern of Recall** (Long Look + Tallow Candle): what a match lights stays lit for the floor.
 * - **Miser's Vault** (Deep Pockets + Gilded Chain): once a floor, a miss on an empty bank costs
 *   `MISERS_VAULT_GOLD` gold instead of the run.
 * - **Cartographer's Thread** (Long Look + Gilded Chain): the Wanderers' footprints last three turns.
 * - **Keystone Heart** (Deep Pockets + Tallow Candle): a Hold released at ten pairs or more refills a miss.
 * - **Unmasking Glass** (Tallow Candle + Gilded Chain) and **Echo Chamber** (Long Look + Deep Pockets):
 *   their mechanics (Masks, Echo) are not built; they can be evolved and do nothing yet.
 */
export const EVOLUTION_RULES_FROM = 77;
export const EVOLUTION_PRICE = 30;
export const MISERS_VAULT_GOLD = 10;
export const KEYSTONE_HEART_PAIRS = 10;
export const CARTOGRAPHERS_THREAD_TURNS = 3;

export interface EvolutionRecipe {
    readonly id: BlueprintId;
    readonly title: string;
    readonly from: readonly [CampUpgradeId, CampUpgradeId];
    /** False while its mechanic is not built: it can be evolved, and does nothing yet. */
    readonly live: boolean;
}

export const EVOLUTIONS: readonly EvolutionRecipe[] = [
    { id: 'lantern_of_recall', title: 'Lantern of Recall', from: ['long_look', 'tallow_candle'], live: true },
    { id: 'misers_vault', title: "Miser's Vault", from: ['deep_pockets', 'gilded_chain'], live: true },
    { id: 'cartographers_thread', title: "Cartographer's Thread", from: ['long_look', 'gilded_chain'], live: true },
    { id: 'keystone_heart', title: 'Keystone Heart', from: ['deep_pockets', 'tallow_candle'], live: true },
    // Masks (`mask-rules.ts`): every mask drops as the floor is dealt.
    { id: 'unmasking_glass', title: 'Unmasking Glass', from: ['tallow_candle', 'gilded_chain'], live: true },
    // Reprise (`reprise-rules.ts`): a Reprise replays five turns.
    { id: 'echo_chamber', title: 'Echo Chamber', from: ['long_look', 'deep_pockets'], live: true }
];

export const evolutionRecipe = (id: BlueprintId): EvolutionRecipe => EVOLUTIONS.find((recipe) => recipe.id === id)!;

export const hasEvolution = (run: Pick<RunState, 'evolutions'>, id: BlueprintId): boolean => (run.evolutions ?? []).includes(id);

const maxed = (run: Pick<RunState, 'relics' | 'storePurchases' | 'runRulesVersion'>, id: CampUpgradeId): boolean =>
    hasRelic(run, id) && relicRank(run, id) >= CAMP_UPGRADE_MAX_RANK;

/** The evolutions this camp offers: blueprint held, both ingredients at rank 3, the first not spent on another. */
export const availableEvolutions = (run: RunState): EvolutionRecipe[] => {
    if ((run.runRulesVersion ?? 0) < EVOLUTION_RULES_FROM) return [];
    // Read straight off the run: the miss bank and the Wanderers import this module, so it keeps its imports light.
    const blueprints = run.blueprints ?? [];
    const evolved = new Set(run.evolutions ?? []);
    const declined = new Set(run.declinedEvolutions ?? []);
    const firstsSpent = new Set(EVOLUTIONS.filter((recipe) => evolved.has(recipe.id)).map((recipe) => recipe.from[0]));
    return EVOLUTIONS.filter(
        (recipe) =>
            blueprints.includes(recipe.id) &&
            !evolved.has(recipe.id) &&
            !declined.has(recipe.id) &&
            !firstsSpent.has(recipe.from[0]) &&
            maxed(run, recipe.from[0]) &&
            maxed(run, recipe.from[1])
    );
};

/** The run with an evolution bought, or null when it is not on offer or not affordable. */
export const applyEvolution = (run: RunState, id: BlueprintId): RunState | null => {
    const gold = runNonNegativeInteger(run.gold ?? 0);
    if (!availableEvolutions(run).some((recipe) => recipe.id === id) || gold < EVOLUTION_PRICE) return null;
    return { ...run, gold: gold - EVOLUTION_PRICE, evolutions: [...(run.evolutions ?? []), id] };
};

/** An evolution on offer the camp could not pay for: gone for the run. */
export const declineEvolution = (run: RunState, id: BlueprintId): RunState => ({ ...run, declinedEvolutions: [...(run.declinedEvolutions ?? []), id] });

/** Miser's Vault: the miss that would end the run, paid in gold once a floor (`miss-bank.ts`). */
export const misersVaultCatches = (run: Pick<RunState, 'evolutions' | 'misersVaultUsedThisFloor' | 'gold'>): boolean =>
    hasEvolution(run, 'misers_vault') && !run.misersVaultUsedThisFloor && runNonNegativeInteger(run.gold ?? 0) >= MISERS_VAULT_GOLD;

/** Turns a Wanderer's footprint lasts (`wanderer-rules.ts`): one, three with the Cartographer's Thread. */
export const footprintTurns = (run: Pick<RunState, 'evolutions'>): number => (hasEvolution(run, 'cartographers_thread') ? CARTOGRAPHERS_THREAD_TURNS : 1);
