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
 * Two turns in five pairs, not the thesis's 0.85. Measured (Gen 181, `sim:cascade`, 48 seeds,
 * floors 1-24): with every match popping, a player who never misses clears a twelve-pair floor
 * in 3.5 turns and one who misses a quarter of them in 4.6, so a par of eleven was under on
 * every floor at every miss rate and said nothing. At 0.4 a twelve-pair floor pars at five: the
 * clean player is under it on most floors, the reference player on about half.
 */
export const PAR_TURNS_PER_PAIR = 0.4;

export const parTurnsForFloor = (pairs: number): number =>
    Math.max(1, Math.ceil(runNonNegativeInteger(pairs) * PAR_TURNS_PER_PAIR));

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
