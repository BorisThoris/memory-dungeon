import type { RunState } from './contracts';
import { runNonNegativeInteger } from './run-number-guards';

/**
 * The par. Every floor states the number of turns a competent player should need, and the run
 * shows `turns / par` at every moment (thesis §41.3). A turn is a pair of flips resolved, match
 * or miss; the gambit's three flips are one turn.
 *
 * Because breaks take pairs the player never matched, a good player beats par comfortably and a
 * player who is missing will not. It is a target, not a gate: missing it costs the floor-end
 * efficiency bonus (§40.5) and nothing else. Phase 2's turn ceiling (§42.2) is three times it.
 *
 * Not the thesis's 0.85. Measured (Gen 181, `sim:cascade`, 48 seeds, floors 1-24): with every
 * match popping, a player who never misses clears a twelve-pair floor in 3.5 turns and one who
 * misses a quarter of them in 4.6, so a par of eleven was under on every floor at every miss rate
 * and said nothing.
 *
 * Gen 204 moved it from 0.4 to 0.45, because the board it was measured against no longer exists.
 * The deal used to grow each suit a solid region, so a match popped what the deal had already
 * stacked for it and floors fell in 4.3 turns; shuffled, the same clean player takes 4.7, because
 * the pairs a break takes now have to be found rather than handed over. Held at 0.4 the clean
 * player came in under par on 0.862 of floors against the 0.9 this target means to hold - so par
 * follows the board rather than the board being clumped back to fit par.
 */
export const PAR_TURNS_PER_PAIR = 0.45;

/**
 * Gen 211: par follows the pop, because the pop is what makes par achievable and its help is not
 * flat.
 *
 * Par was one rate times the board. That rate only works where the pop is at its best, and measured
 * across a hundred floors the pop's share of a board is a hill rather than a line:
 *
 *   4 pairs 0.50   11 pairs 0.65   14 pairs 0.75   17 pairs 0.60   22 pairs 0.48   24 pairs 0.48
 *
 * It peaks around fourteen pairs and falls away on the big boards, where four suits of six pairs
 * are spread over forty-eight cells and a bounded wave reaches a smaller fraction of each. A flat
 * rate calibrated to the peak is therefore too tight at BOTH ends, and it was: Gen 210 found a
 * clean player over par on floors 1, 2 and 6, and the deep game is worse - **11.6 turns against a
 * par of 9 on floor 30, 14.0 against 10 on floor 40, 15.8 against 11 on floor 100.** From about
 * floor 20 on, the under-par bonus and the within-par objective were unreachable by competent play.
 *
 * Two terms, both from the mechanism rather than from a fit:
 *
 * - **The rate rises past thirteen pairs**, by `PAR_RATE_RISE_PER_PAIR` for each pair over the line,
 *   which is where the measurement says the pop stops keeping up with the board.
 * - **One turn of miss allowance, on every floor.** Par allowed for no misses at all, and a
 *   competent player makes 0.2 on the early floors and 2.6 to 3.0 on the deep ones. This replaces
 *   Gen 210's small-floor slack: that fix was this one seen from the other end, and it falls out of
 *   this rule rather than sitting beside it.
 *
 * Measured after: a clean player is under par on every floor from 1 to 100.
 */
export const PAR_FLAT_RATE_PAIRS = 13;
export const PAR_RATE_RISE_PER_PAIR = 0.025;
export const PAR_MISS_ALLOWANCE = 1;

/** Turns per pair on a board of this size: flat to thirteen pairs, rising after it. */
export const parRateForPairs = (pairs: number): number =>
    PAR_TURNS_PER_PAIR + PAR_RATE_RISE_PER_PAIR * Math.max(0, runNonNegativeInteger(pairs) - PAR_FLAT_RATE_PAIRS);

export const parTurnsForFloor = (pairs: number): number => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) return 1;
    return Math.max(1, Math.ceil(count * parRateForPairs(count)) + PAR_MISS_ALLOWANCE);
};

/** Turns the run has resolved on this floor, read from its own ledger. */
export const turnsTakenThisFloor = (run: Pick<RunState, 'turnsThisFloor'>): number =>
    runNonNegativeInteger(run.turnsThisFloor);

export const parTurnsForRun = (run: Pick<RunState, 'board'>): number =>
    parTurnsForFloor(run.board?.pairCount ?? 0);

/**
 * The turn ceiling (thesis §42.2). There are no lives; a run ends when a floor is not cleared
 * within three times its par. Three times par is a player missing two thirds of their flips: not
 * a difficulty gate but a floor under competence, there so that a run *can* end and be a story.
 * The run never ends because you forgot - it ends because you could not finish a board at all.
 */
export const TURN_CEILING_PAR_MULTIPLIER = 3;

export const turnCeilingForFloor = (pairs: number): number => parTurnsForFloor(pairs) * TURN_CEILING_PAR_MULTIPLIER;

export const turnCeilingForRun = (run: Pick<RunState, 'board'>): number =>
    turnCeilingForFloor(run.board?.pairCount ?? 0);

/** Turns left before the ceiling ends the run, never below zero. */
export const turnsToCeiling = (run: Pick<RunState, 'board' | 'turnsThisFloor'>): number =>
    Math.max(0, turnCeilingForRun(run) - turnsTakenThisFloor(run));

/** A floor still open on its ceiling turn ends the run. A floor that cleared on that turn is a clear. */
export const floorHitTurnCeiling = (run: Pick<RunState, 'board' | 'turnsThisFloor' | 'status'>): boolean =>
    run.status === 'playing' && run.board != null && turnsTakenThisFloor(run) >= turnCeilingForRun(run);
