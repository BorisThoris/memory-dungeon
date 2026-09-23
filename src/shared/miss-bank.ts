import type { RunState } from './contracts';
import { clearResolveState } from './run-timer-rules';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The miss bank: the run's budget for being wrong, counted in misses.
 *
 * Gen 183 took the lives out and put the run's ending on a turn ceiling; the ceiling became a
 * turn bank on 2026-09-23, and the same day the pop was capped and a floor started taking twice
 * the turns. Played, the bank read "17 left" on floor 4 - a count that folded the turns a floor
 * needs to be matched at all into the turns a player could waste, and so read as seventeen lives
 * for a floor of nine pairs. The player's verdict: undeserved, too safe, one or two a floor at
 * most.
 *
 * So the budget is denominated in the thing it is actually for. A run opens with
 * `MISS_BANK_OPENING` misses; every new floor deposits `MISS_BANK_FLOOR_GRANT` on top of what was
 * left unspent, never above `MISS_BANK_CAP`; a miss spends one, and a miss with none left ends the
 * run. Measured on the scheduled floors with a perfect-memory player over twenty seeds (median
 * floor reached, runs capped at sixty):
 *
 *   miss     2 / +1 / 3     2 / +2 / 3     3 / +2 / 4     3 / +2 / 5
 *   10%      15             33             37             50
 *   15%      11             13             21             27
 *   20%       7              9             11             15
 *   25%       5              7              9             10
 *   35%      4              4              5              5
 *
 * Three, two a floor, four in hand: a careful player goes deep, a sloppy one is out by floor ten,
 * and the count on the head is a number a player can hold in their own hand. Nothing else about a miss changed: it still costs the chain, still counts a try (rating)
 * and a turn (par). What went is the turn ceiling - with misses bounded and matches bounded by
 * the board, a floor cannot run forever, and a rule nobody could read was doing nothing but
 * confusing the one they can.
 *
 * A run built without a bank (a fixture, a census that holds the bank open) has no budget and
 * never ends this way; `missesLeft` reads it as `null`.
 */
export const MISS_BANK_OPENING = 3;
export const MISS_BANK_FLOOR_GRANT = 2;
export const MISS_BANK_CAP = 4;

export type MissBankRun = Pick<RunState, 'missBankCarry'>;

/** Misses the run may still make before one ends it; `null` for a run with no budget at all. */
export const missesLeft = (run: MissBankRun): number | null =>
    run.missBankCarry == null ? null : runNonNegativeInteger(run.missBankCarry);

/** What a run carries onto its first floor. */
export const openingMissBank = (): number => MISS_BANK_OPENING;

/** What the next floor opens with: the unspent misses plus the floor's grant, under the cap. */
export const carryMissBank = (run: MissBankRun): number | undefined => {
    const left = missesLeft(run);
    return left == null ? undefined : Math.min(MISS_BANK_CAP, left + MISS_BANK_FLOOR_GRANT);
};

/**
 * Applied after every resolved turn. A miss spends one from the bank; a miss made with the bank
 * already empty ends the run. A floor that cleared on the same turn has already left `playing`.
 */
export const applyMissBudget = (before: RunState, after: RunState): RunState => {
    const missed = runNonNegativeInteger(after.stats.mismatches) > runNonNegativeInteger(before.stats.mismatches);
    const left = missesLeft(after);
    if (!missed || left == null) {
        return after;
    }
    if (left > 0) {
        return { ...after, missBankCarry: left - 1 };
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
