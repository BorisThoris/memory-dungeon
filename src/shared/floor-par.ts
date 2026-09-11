import type { RunState } from './contracts';
import { pairsForFloor } from './pair-curve';
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

/**
 * Gen 220: the opening gets a turn, because measured against par it was the tightest part of the
 * game and it is where the player knows least.
 *
 * PopCap's Jason Kapalka on Peggle, quoted in `docs/RESEARCH_NOTES_2.md`: *"We do apply a lot of
 * extra 'luck' to players in their first half-dozen levels or so to keep them from getting
 * frustrated while learning the ropes."* The reference product for a cascade that feels good tilts
 * the first six levels toward the new player. This game tilted them the other way, and nothing said
 * so, because every reading of the curve until now was in turns rather than in turns against par.
 *
 * Measured (`sim:curve`, ten seeds, all fifty-two floors, turns divided by par):
 *
 *   floors 1-6    mean 0.797   worst 0.900 (floors 2 and 6)
 *   floors 7-52   mean 0.640   worst 0.857
 *
 * So the learning player was spending four fifths of their allowance while the veteran spent two
 * thirds, and the two tightest floors in the whole curve were the second and the sixth. Gen 211 saw
 * half of this - it fixed the rate where the pop stops keeping up with a growing board - but the
 * small boards were left on the flat rate plus a constant, and a constant is not a rate correction.
 *
 * **One turn, on every board the opening deals.** Floors 1-6 are 4, 6, 7, 9, 10 and 11 pairs and
 * floor 7 is twelve, so `pairsForFloor(PAR_OPENING_FLOORS)` separates them exactly; the strictness
 * of that step is not assumed, `floor-par.test.ts` fails if the pair curve ever closes it. After:
 * floors 1-6 mean 0.658, worst 0.771 - under the deep game's worst on every floor, which is the
 * property being claimed rather than a number that looked right.
 *
 * **Why it stops at one turn.** A second would put floor 1's par at five turns on a four-pair
 * board, and par above the pair count is a target a player with a perfect memory cannot miss even
 * if the pop never fires once - at which point par has stopped measuring anything. Par stays at or
 * under the board's own pair count on every reachable floor, floor 1 sits exactly on that line, and
 * `floor-par.test.ts` holds it there.
 */
export const PAR_OPENING_FLOORS = 6;
export const PAR_OPENING_ALLOWANCE = 1;

/** The largest board the opening deals. Read from the curve so the two cannot drift apart. */
export const parOpeningPairs = (): number => pairsForFloor(PAR_OPENING_FLOORS);

export const parOpeningAllowanceForPairs = (pairs: number): number =>
    runNonNegativeInteger(pairs) <= parOpeningPairs() ? PAR_OPENING_ALLOWANCE : 0;

export const parTurnsForFloor = (pairs: number): number => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) return 1;
    return Math.max(
        1,
        Math.ceil(count * parRateForPairs(count)) + PAR_MISS_ALLOWANCE + parOpeningAllowanceForPairs(count)
    );
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
