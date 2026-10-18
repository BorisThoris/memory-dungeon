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
export type CurioItemId = 'crucible';

export const CURIO_ITEM_IDS: readonly CurioItemId[] = ['crucible'];

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

const CHARGE_FIELD: Readonly<Record<CurioItemId, 'crucibleCharges'>> = {
    crucible: 'crucibleCharges'
};

/** The item a claimed Curio grants: seeded by run, floor and how many Curios this run has opened. */
export const curioItemFor = (run: Pick<RunState, 'runSeed' | 'curiosClaimedThisRun'>, level: number): CurioItemId => {
    const rng = createMulberry32(hashStringToSeed(`curio-item:${run.runSeed}:${level}:${runNonNegativeInteger(run.curiosClaimedThisRun)}`));
    return CURIO_ITEM_IDS[pickRngIndex(rng, CURIO_ITEM_IDS.length)]!;
};

/** The run after a Curio's pair is matched: one curio item in hand, and the drop recorded for the HUD. */
export const claimCurio = (run: RunState, level: number, pairKey: string): RunState => {
    const item = curioItemFor(run, level);
    const field = CHARGE_FIELD[item];
    const claimed = runNonNegativeInteger(run.curiosClaimedThisRun);
    return {
        ...run,
        [field]: runNonNegativeInteger(run[field]) + 1,
        curiosClaimedThisRun: claimed + 1,
        lastCurioDrop: { key: `curio:${run.runSeed}:${level}:${claimed}:${pairKey}`, item }
    };
};
