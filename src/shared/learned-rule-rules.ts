import { DEPTH_LEARNED_FROM, depthHas } from './depth-rules';
import type { LearnedRule, LearnedRuleId, RunState, TileSuit } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';
import { TILE_SUITS } from './tile-suit-rules';

/**
 * The dungeon learns you (DGE-022, rules 86): from floor 41 every floor tells you one thing it has
 * learned about how you play, before the first flip.
 *
 * The rule is one of a fixed table, and it never changes how hard the floor is: it only chooses
 * **which** pairs an existing mechanic lands on - the Masks (`mask-rules.ts`), the Wanderers
 * (`wanderer-rules.ts`), the Sleepers (`sleeper-rules.ts`) - never how many, and never anything the
 * floor does not already deal. The learned thing is the element you have matched most this run
 * (`elementResonance`), ties broken in the suits' own order; which rule of the table is drawn comes
 * from the run's seed and the floor, so the same run and the same play give the same rule. Thesis
 * §25.13: no hidden difficulty adjustment. This is told adaptation, said aloud every floor.
 */
export const LEARNED_RULES_FROM = 86;
export const LEARNED_RULES_FIRST_FLOOR = 41;

export const LEARNED_RULE_TABLE: readonly LearnedRuleId[] = ['masked_suit', 'wandering_suit', 'sleeping_suit'];

/** The element the run has matched most, or null before any match. */
export const mostMatchedSuit = (run: Pick<RunState, 'elementResonance'>): TileSuit | null => {
    const stacks = run.elementResonance ?? {};
    let best: TileSuit | null = null;
    for (const suit of TILE_SUITS) {
        if (runNonNegativeInteger(stacks[suit]) > (best ? runNonNegativeInteger(stacks[best]) : 0)) best = suit;
    }
    return best;
};

/** The rule this floor is told: one of the table, about the element matched most. */
export const pickLearnedRule = (run: Pick<RunState, 'runSeed' | 'runRulesVersion' | 'elementResonance'> & Partial<Pick<RunState, 'depth'>>, level: number): LearnedRule | null => {
    // Depth 18 (`depth-rules.ts`): from floor 25.
    const first = depthHas(run, 'learned_early') ? DEPTH_LEARNED_FROM : LEARNED_RULES_FIRST_FLOOR;
    if ((run.runRulesVersion ?? 0) < LEARNED_RULES_FROM || level < first) return null;
    const suit = mostMatchedSuit(run);
    if (!suit) return null;
    const rng = createMulberry32(hashStringToSeed(`learned:${run.runSeed}:${run.runRulesVersion}:${level}`));
    return { id: LEARNED_RULE_TABLE[pickRngIndex(rng, LEARNED_RULE_TABLE.length)]!, suit };
};

/** The element a dealer should prefer under this rule, or null when the rule is another dealer's. */
export const preferredSuitFor = (rule: LearnedRule | null | undefined, id: LearnedRuleId): TileSuit | null => (rule && rule.id === id ? rule.suit : null);

/**
 * A dealer's draw under a learned rule: from the pairs of the preferred element while any are left, then
 * from the rest. With no preference it is the dealer's own draw, so a floor without a learned rule deals
 * exactly as it did.
 */
export const preferredDrawIndex = (pool: readonly string[], rng: () => number, isPreferred: ((pairKey: string) => boolean) | null): number => {
    if (isPreferred) {
        const preferred = pool.flatMap((pairKey, index) => (isPreferred(pairKey) ? [index] : []));
        if (preferred.length > 0) return preferred[pickRngIndex(rng, preferred.length)]!;
    }
    return pickRngIndex(rng, pool.length);
};
