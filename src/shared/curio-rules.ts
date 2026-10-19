import type { RunState } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * Curios (2026-10-18): the pickup that carries the run's stranger items.
 *
 * The owner asked for more items "that do interesting and different things" - ones with a pro and
 * a con, ones that unmake one kind of card and spawn another, ones that set the arena off. There
 * is no store screen any more (`automatic-camp-rules.ts`), so items reach the player on the board:
 * a Curio rides a card like the meteor shard does, and matching its pair puts one curio item in
 * the player's hand. Which one is seeded by the run, the floor and the claim, so a replay draws
 * the same.
 *
 * A Curio never displaces another pickup: it is a score glint turned over by its own seeded roll
 * (`board-tile-generation-rules.ts`), so the meteor shards and every other draw land where they
 * always did.
 */
export type CurioItemId = 'crucible' | 'storm_glass' | 'misers_purse' | 'still_bell';

/** Rules 67 add the Storm Glass to what a Curio may hold (`storm-glass-rules.ts`). */
export const STORM_GLASS_RULES_VERSION = 67;

/** Rules 68 add the Miser's Purse, a relic, to what a Curio may hold (`run-relic-rules.ts`). */
export const MISERS_PURSE_RULES_VERSION = 68;

/** Rules 69 add the Still Bell (`still-bell-rules.ts`). */
export const STILL_BELL_RULES_VERSION = 69;

/** What a Curio may hold under a run's rules: an older key draws what it always drew. */
export const curioItemsForRules = (rulesVersion: number): readonly CurioItemId[] =>
    rulesVersion >= STILL_BELL_RULES_VERSION
        ? ['crucible', 'storm_glass', 'misers_purse', 'still_bell']
        : rulesVersion >= MISERS_PURSE_RULES_VERSION
        ? ['crucible', 'storm_glass', 'misers_purse']
        : rulesVersion >= STORM_GLASS_RULES_VERSION
          ? ['crucible', 'storm_glass']
          : ['crucible'];


/** Rules 66 deal Curios; a run (or a shared key) on older rules never sees one, so its replay deals what it dealt. */
export const CURIO_RULES_VERSION = 66;

/** The first floor a Curio can ride a card: floor 1 teaches the board, not the items. */
export const CURIO_FROM_FLOOR = 2;
/** The share of a floor's score glints that turn into Curios (about one Curio every five floors). */
export const CURIO_GLINT_SHARE = 0.2;

/** True when a score glint on this card becomes a Curio. Its own stream: no other draw moves. */
export const curioReplacesGlint = (runSeed: number, rulesVersion: number, level: number, pairKey: string): boolean =>
    rulesVersion >= CURIO_RULES_VERSION &&
    level >= CURIO_FROM_FLOOR &&
    createMulberry32(hashStringToSeed(`curio:${rulesVersion}:${runSeed}:${level}:${pairKey}`))() < CURIO_GLINT_SHARE;

const CHARGE_FIELD: Readonly<Record<CurioItemId, 'crucibleCharges' | 'stormGlassCharges' | 'misersPurseOffers' | 'stillBellCharges'>> = {
    crucible: 'crucibleCharges',
    storm_glass: 'stormGlassCharges',
    still_bell: 'stillBellCharges',
    // A relic is offered, not forced: it waits in the dock until the player takes it up (`misers-purse-rules.ts`).
    misers_purse: 'misersPurseOffers'
};

/** The item a claimed Curio grants: seeded by run, floor and how many Curios this run has opened. */
export const curioItemFor = (run: Pick<RunState, 'runSeed' | 'runRulesVersion' | 'curiosClaimedThisRun' | 'relics' | 'misersPurseOffers'>, level: number): CurioItemId => {
    // A relic comes once: a Curio never offers the purse to a run that carries it or has it on offer.
    const purseSeen = (run.relics ?? []).includes('misers_purse') || runNonNegativeInteger(run.misersPurseOffers) > 0;
    const pool = curioItemsForRules(runNonNegativeInteger(run.runRulesVersion)).filter((item) => item !== 'misers_purse' || !purseSeen);
    const rng = createMulberry32(hashStringToSeed(`curio-item:${run.runSeed}:${level}:${runNonNegativeInteger(run.curiosClaimedThisRun)}`));
    return pool[pickRngIndex(rng, pool.length)]!;
};

/** The run after a Curio's pair is matched: one curio item in hand, and the drop recorded for the HUD. */
export const claimCurio = (run: RunState, level: number, pairKey: string): RunState => {
    const item = curioItemFor(run, level);
    const claimed = runNonNegativeInteger(run.curiosClaimedThisRun);
    const drop = { curiosClaimedThisRun: claimed + 1, lastCurioDrop: { key: `curio:${run.runSeed}:${level}:${claimed}:${pairKey}`, item } };
    const field = CHARGE_FIELD[item];
    return { ...run, ...drop, [field]: runNonNegativeInteger(run[field]) + 1 };
};
