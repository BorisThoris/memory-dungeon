import type { MissBankGrant, RunState } from './contracts';
import { clearResolveState } from './run-timer-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The miss bank: the run's budget for being wrong, counted in misses - and, since 2026-09-24,
 * earned rather than granted, with a shelf life.
 *
 * Gen 183 took the lives out and put the run's ending on a turn ceiling; the ceiling became a
 * turn bank on 2026-09-23, and the same day the pop was capped and a floor started taking twice
 * the turns. Played, the bank read "17 left" on floor 4 - a count that folded the turns a floor
 * needs to be matched at all into the turns a player could waste, and so read as seventeen lives
 * for a floor of nine pairs. The player's verdict: undeserved, too safe, one or two a floor at
 * most. So the budget was denominated in the thing it is actually for: misses, three to open, two
 * a floor, four in hand.
 *
 * The next day the ask was sharper still: a miss should be *won* - by clearing a floor, or by a
 * chain - and what is won should last "the next level plus three levels from that round", not
 * forever. A flat deposit every floor is a subscription; a run that banks four by floor 3 and
 * keeps them to floor 30 has never once been asked to earn its life. So the bank is a ledger of
 * grants, each stamped with the floor it was earned on:
 *
 * - A run opens with `MISS_BANK_OPENING` misses, earned on floor 1.
 * - Clearing a floor earns `MISS_BANK_FLOOR_GRANT`, stamped with the floor cleared.
 * - Every `MISS_BANK_COMBO_RUNG` matches in a row on a floor earns one more, stamped with that
 *   floor and spendable at once - the chain is literally how many things in a row you remembered,
 *   and it is the one skill the game asks for, so it is the one way to buy life mid-floor.
 * - A grant earned on floor N is good through floor N + `MISS_BANK_LIFETIME_FLOORS` and gone on
 *   the floor after. A miss spends from the grant that would go first, so nothing a player earned
 *   is wasted while an older one sits unused.
 * - Never more than `MISS_BANK_CAP` in hand. A grant that would overflow it pushes the oldest out
 *   instead of being lost, so a long chain on a full bank still buys time: it refreshes the shelf.
 *
 * Measured on the scheduled floors with a perfect-memory player over twenty seeds (median floor
 * reached, runs capped at sixty; `yarn sim:survival`):
 *
 *   miss     3 / +2 flat / cap 4 (before)     3 / +1 a floor, +1 per 5-chain, 3-floor shelf
 *   10%      37                               45
 *   15%      21                               17
 *   20%      11                                6
 *   25%       9                                6
 *   35%       5                                4
 *
 * A careful player still goes deep, and now because the chains they hold keep the bank fed; a
 * sloppy one is out by floor eight, because the misses they took on floor 2 stopped being paid
 * for on floor 6. Nothing else about a miss changed: it still costs the chain, still counts a try
 * (rating) and a turn (par).
 *
 * A run built without a bank (a fixture, a census that holds the bank open) has no budget and
 * never ends this way; `missesLeft` reads it as `null`.
 */
export const MISS_BANK_OPENING = 3;
export const MISS_BANK_FLOOR_GRANT = 1;
export const MISS_BANK_COMBO_RUNG = 5;
export const MISS_BANK_LIFETIME_FLOORS = 3;
export const MISS_BANK_CAP = 4;

export type { MissBankGrant };

export type MissBankRun = Pick<RunState, 'missBank' | 'board'>;

const grantFloor = (grant: MissBankGrant): number => Math.max(1, runNonNegativeInteger(grant.floor));

/** The last floor a grant may still be spent on. */
export const missBankGrantLastFloor = (grant: Pick<MissBankGrant, 'floor'>): number =>
    grantFloor(grant as MissBankGrant) + MISS_BANK_LIFETIME_FLOORS;

/** The ledger, tidy: empty grants dropped, same-floor grants merged, soonest to expire first. */
export const normalizeMissBank = (grants: readonly MissBankGrant[]): MissBankGrant[] => {
    const byFloor = new Map<number, number>();
    for (const grant of grants) {
        const misses = runNonNegativeInteger(grant.misses);
        if (misses <= 0) continue;
        const floor = grantFloor(grant);
        byFloor.set(floor, (byFloor.get(floor) ?? 0) + misses);
    }
    return [...byFloor.entries()].sort(([a], [b]) => a - b).map(([floor, misses]) => ({ floor, misses }));
};

const sumMisses = (grants: readonly MissBankGrant[]): number =>
    grants.reduce((sum, grant) => sum + runNonNegativeInteger(grant.misses), 0);

/** Misses the run may still make before one ends it; `null` for a run with no budget at all. */
export const missesLeft = (run: Pick<RunState, 'missBank'>): number | null =>
    run.missBank == null ? null : sumMisses(normalizeMissBank(run.missBank));

/** The grant that goes first, for the pause sheet: how many, and the last floor they last through. */
export const missBankSoonestToGo = (
    run: Pick<RunState, 'missBank'>
): { misses: number; lastFloor: number } | null => {
    const first = run.missBank == null ? undefined : normalizeMissBank(run.missBank)[0];
    return first ? { misses: first.misses, lastFloor: missBankGrantLastFloor(first) } : null;
};

/** What a run carries onto its first floor. */
export const openingMissBank = (): MissBankGrant[] => [{ floor: 1, misses: MISS_BANK_OPENING }];

/**
 * A deposit, under the cap. Over it, the grants that would expire first make room: a chain held
 * on a full bank is not wasted, it pushes the shelf forward.
 */
export const grantMisses = (grants: readonly MissBankGrant[], floor: number, misses: number): MissBankGrant[] => {
    const next = normalizeMissBank([...grants, { floor, misses }]);
    let over = sumMisses(next) - MISS_BANK_CAP;
    for (const grant of next) {
        if (over <= 0) break;
        const taken = Math.min(over, grant.misses);
        grant.misses -= taken;
        over -= taken;
    }
    return normalizeMissBank(next);
};

/** One miss spent, from the grant that would have gone first. */
export const spendMiss = (grants: readonly MissBankGrant[]): MissBankGrant[] => {
    const next = normalizeMissBank(grants);
    if (next[0]) next[0].misses -= 1;
    return normalizeMissBank(next);
};

/** The grants still good on a floor. */
export const missBankOnFloor = (grants: readonly MissBankGrant[], level: number): MissBankGrant[] =>
    normalizeMissBank(grants).filter((grant) => missBankGrantLastFloor(grant) >= level);

/**
 * What the next floor opens with: what the cleared floor left unspent and not yet expired, plus
 * the clear's own grant, stamped with the floor that earned it.
 */
export const carryMissBank = (run: MissBankRun, nextLevel: number): MissBankGrant[] | undefined => {
    if (run.missBank == null) return undefined;
    const clearedFloor = Math.max(1, runNonNegativeInteger(run.board?.level ?? nextLevel - 1));
    const kept = missBankOnFloor(run.missBank, nextLevel);
    return grantMisses(kept, clearedFloor, MISS_BANK_FLOOR_GRANT);
};

/** Misses a chain that climbed from `before` to `after` earns: one per rung crossed. */
export const comboMissesEarned = (before: number, after: number): number => {
    const rungsBefore = Math.floor(runNonNegativeInteger(before) / MISS_BANK_COMBO_RUNG);
    const rungsAfter = Math.floor(runNonNegativeInteger(after) / MISS_BANK_COMBO_RUNG);
    return Math.max(0, rungsAfter - rungsBefore);
};

/**
 * Applied after every resolved turn. A chain that crossed a rung earns into the bank; a miss
 * spends one from it; a miss made with the bank already empty ends the run. A floor that cleared
 * on the same turn has already left `playing`, and still banks what its last chain earned, so the
 * next floor opens with it.
 */
export const applyMissBudget = (before: RunState, after: RunState): RunState => {
    if (after.missBank == null) {
        return after;
    }
    const level = Math.max(1, runNonNegativeInteger(after.board?.level ?? before.board?.level ?? 1));
    const earned = comboMissesEarned(before.stats.currentStreak, after.stats.currentStreak);
    if (earned > 0) {
        return { ...after, missBank: grantMisses(after.missBank, level, earned) };
    }
    const missed = runNonNegativeInteger(after.stats.mismatches) > runNonNegativeInteger(before.stats.mismatches);
    if (!missed) {
        return after;
    }
    const left = missesLeft(after) ?? 0;
    if (left > 0) {
        return { ...after, missBank: spendMiss(after.missBank) };
    }
    if (after.status !== 'playing') {
        return after;
    }
    return {
        ...after,
        status: 'gameOver',
        runEndReason: 'miss_budget',
        board: after.board ? { ...after.board, flippedTileIds: [] } : after.board,
        timerState: clearResolveState(after)
    };
};
