import type { RunState } from './contracts';
import { DREAD_TIERS } from './dread-rules';

/**
 * The Dread spends (DGE-003/009, the owner's choice of 2026-10-23: layered on the schedules).
 *
 * The plan's priced table - an ordinary pair 1, a Wanderer pair 4, a mask 6, a Sleeper pair 9, a
 * stacked mutator 12, a boss rule 20 - with the Dread as the budget. The floor schedules stay the
 * floor's minimum, so the Depth rungs that move them still mean what they say; from Awake the Dread
 * buys more of the families the floor already deals, dearest first, one at a time round the table,
 * up to `DREAD_EXTRA_CAP` more of each. A family the budget has outgrown - one that costs under an
 * eighth of it - is too cheap to be worth the Dread and is skipped, so a floor at It knows you is
 * composed of Sleepers and masks rather than more Wanderers. Mutators and boss rules are not for
 * sale: the schedule places those.
 *
 * What it bought is told on the board crown before the first flip (thesis 25.13: no hidden
 * adjustment), and the same run at the same floor buys the same, since the Dread is derived from the
 * floor and the realms entered, never from play.
 */
export const DREAD_COMPOSITION_FROM = 87;

export type DreadFamily = 'sleeper' | 'mask' | 'wanderer';

/** The priced table, dearest first, as the plan wrote it; the families are the only rows for sale. */
export const DREAD_PRICES = { pair: 1, wanderer: 4, mask: 6, sleeper: 9, mutator: 12, boss: 20 } as const;
const FOR_SALE: readonly DreadFamily[] = ['sleeper', 'mask', 'wanderer'];

/** The Dread the budget starts at: the Awake tier's, read off the tier table so the two cannot drift apart. */
export const DREAD_BUYS_FROM = DREAD_TIERS.find((tier) => tier.id === 'awake')!.from;
/** Points the budget gains with every doubling of the Dread past the tier it starts at. */
export const DREAD_POINTS_PER_DOUBLING = 6;
/** The most any one family is bought on a floor. */
export const DREAD_EXTRA_CAP = 2;
/** A family that costs under this share of the budget is too cheap to buy. */
export const DREAD_TOO_CHEAP_SHARE = 1 / 8;

export type DreadPurchase = Readonly<Record<DreadFamily, number>>;
export const NO_DREAD_PURCHASE: DreadPurchase = { sleeper: 0, mask: 0, wanderer: 0 };

/** The floor's budget at a Dread: nothing before Awake, then six points a doubling past it. */
export const dreadBudget = (dread: number): number =>
    dread < DREAD_BUYS_FROM ? 0 : DREAD_POINTS_PER_DOUBLING * (1 + Math.floor(Math.log2(dread / DREAD_BUYS_FROM)));

/**
 * What the Dread buys on a floor: round the table dearest first, one of a family a turn, among the
 * families the floor deals (`dealt`), while the budget can pay, each up to the cap, skipping one the
 * budget has outgrown.
 */
export const dreadPurchase = (dread: number, dealt: DreadPurchase): DreadPurchase => {
    let budget = dreadBudget(dread);
    const total = budget;
    const bought: Record<DreadFamily, number> = { sleeper: 0, mask: 0, wanderer: 0 };
    const open = FOR_SALE.filter((family) => dealt[family] > 0 && DREAD_PRICES[family] >= total * DREAD_TOO_CHEAP_SHARE);
    let spent = true;
    while (spent) {
        spent = false;
        for (const family of open) {
            if (bought[family] < DREAD_EXTRA_CAP && budget >= DREAD_PRICES[family]) {
                bought[family] += 1;
                budget -= DREAD_PRICES[family];
                spent = true;
            }
        }
    }
    return bought;
};

/** Whether the run composes its floors with the Dread. */
export const dreadComposes = (run: Pick<RunState, 'runRulesVersion'>): boolean => (run.runRulesVersion ?? 0) >= DREAD_COMPOSITION_FROM;
