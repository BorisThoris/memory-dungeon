import type { BoardState, RunState } from './contracts';
import { pairsForFloor } from './pair-curve';
import { runNonNegativeInteger } from './run-number-guards';
import { SCATTERED_SUIT_CEILING, TILE_SUITS, boardPaletteWidth } from './tile-suit-rules';

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

/**
 * Gen 259: par follows the pop for the palette too, not just for the board.
 *
 * Gen 211 made par follow the pop for board *size*. It never followed it for palette *width*, and a
 * third of the game's floors deal a narrow one: `SCATTERED_SUIT_CEILING` holds every scattered and
 * spotlight floor to two suits however big its board (`tile-suit-rules.ts`), which is correct and
 * measured - a third suit halves a scattered floor's pop rate (Gen 191). Par did not know. Measured
 * over 2080 boards and forty seeds, a clean player's turns divided by par:
 *
 *   two suits   mean 0.494 over 640 boards
 *   three suits mean 0.658 over 240 boards
 *   four suits  mean 0.731 over 1200 boards
 *
 * So the floor-end efficiency bonus and the within-par objective were most of a target on a clumped
 * floor and half a target on a scattered one, decided by which archetype the schedule happened to
 * draw. Relief landing where the seed puts it rather than where it is authored - and the game
 * already has a `breather` archetype for authored relief.
 *
 * **The magnitude is a controlled measurement, not a fit.** Grouping live floors by palette confounds
 * the palette with the archetype that chose it, so this was measured the other way: one board, built
 * once per seed from a single archetype with no mutators, its suits re-dealt at two, three and four
 * over twenty-four seeds and eight board sizes. Turns per pair, as a fraction of the same board's
 * four-suit cost:
 *
 *   pairs      12     13     14     16     17     19     22     24    mean
 *   two suits  0.736  0.766  0.711  0.820  0.728  0.688  0.733  0.727  0.739
 *   three      0.943  0.873  0.855  1.093  0.937  0.952  1.106  0.948  0.963
 *
 * Two things fall out, and the first one killed the model this generation started with. The narrow
 * palette's discount is a **constant fraction of the rate at every board size** - a two-suit board's
 * cost per pair rises with the board exactly as steeply as a four-suit board's (0.358 to 0.412 over
 * 12 to 24 pairs against 0.486 to 0.566), so this is a factor on the whole rate and emphatically not
 * a later start to `PAR_RATE_RISE_PER_PAIR`. The first pass here assumed the latter, from the live
 * floors, and the controlled deal says it was the archetype rather than the palette.
 *
 * Second: **three suits and four are the same board.** 0.963, with three of eight sizes above one -
 * no effect to separate from noise. Which is what `tile-suit-rules.ts` already says in words: a
 * clumped floor gives each suit one region, so a third and a fourth suit cost the break almost
 * nothing, and it is the step down to two - where one suit holds half the board and almost every
 * match touches its own kind - that changes the pop. So only the narrow palette takes a factor, and
 * every clumped floor's par is unchanged to the turn.
 *
 * No reachable board deals one suit (none of the 2080 did; the deal's legibility floor is two on any
 * board a player meets), and `boardPaletteWidth` reads an empty board as the full palette, so one
 * suit takes the narrow factor rather than an invented number of its own.
 */
export const PAR_NARROW_PALETTE_RATE_FACTOR = 0.74;

/**
 * What a board's palette does to its par rate: one at three suits and four, the narrow factor at or
 * below `SCATTERED_SUIT_CEILING`.
 */
export const parPaletteRateFactor = (suits: number): number => {
    const palette = Math.max(1, Math.min(TILE_SUITS.length, Math.floor(runNonNegativeInteger(suits)) || 1));
    return palette <= SCATTERED_SUIT_CEILING ? PAR_NARROW_PALETTE_RATE_FACTOR : 1;
};

/**
 * Turns per pair on a board of this size and palette: flat to thirteen pairs and rising after it
 * (Gen 211), the whole of it scaled by what the palette does to the pop (Gen 259).
 *
 * The palette defaults to the full one, because that is the board every rate here was calibrated
 * against and a caller holding only a pair count cannot know better. So a caller that does not pass a
 * palette gets exactly what it got before this parameter existed, at every pair count - which
 * `floor-par.test.ts` holds, and which `suitCountForPairs` would not have done: it reads a six-pair
 * board as two suits where the deal gives one three.
 */
export const parRateForPairs = (pairs: number, suits: number = TILE_SUITS.length): number =>
    (PAR_TURNS_PER_PAIR + PAR_RATE_RISE_PER_PAIR * Math.max(0, runNonNegativeInteger(pairs) - PAR_FLAT_RATE_PAIRS)) *
    parPaletteRateFactor(suits);

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

const parTurnsFromRate = (count: number, palette: number): number =>
    Math.max(
        1,
        Math.ceil(count * parRateForPairs(count, palette)) + PAR_MISS_ALLOWANCE + parOpeningAllowanceForPairs(count)
    );

/**
 * A bigger board is never cheaper - which the terms do not give for free once the palette scales the
 * rate.
 *
 * `PAR_OPENING_ALLOWANCE` is a step *down* at the largest board the opening deals, and it sits on top
 * of a rate rather than inside it. At the full palette the rate's own growth across that step happens
 * to cover it, which is why nothing caught this before and why `floor-par.test.ts` asserts the step
 * rather than assuming it. Scaled by `PAR_NARROW_PALETTE_RATE_FACTOR` the growth no longer does:
 * measured, an eleven-pair two-suit board came out at six turns and a twelve-pair one at five, so a
 * player crossing from floor 6 to floor 7 on scattered floors would have been given a *smaller*
 * allowance for a bigger board.
 *
 * So par takes the larger of its own reading and the reading at the last board the allowance covers.
 * The rate term is non-decreasing in pairs, so that one comparison is the whole of it - there is no
 * other step to outrun. At the full palette it changes nothing, which the default-unchanged test
 * holds.
 */
export const parTurnsForFloor = (pairs: number, suits?: number): number => {
    const count = runNonNegativeInteger(pairs);
    if (count === 0) return 1;
    const palette = suits ?? TILE_SUITS.length;
    const openingEdge = parOpeningPairs();
    return count <= openingEdge
        ? parTurnsFromRate(count, palette)
        : Math.max(parTurnsFromRate(count, palette), parTurnsFromRate(openingEdge, palette));
};

/** Par for a board, read off the board: its pair count and the palette it was actually dealt. */
export const parTurnsForBoard = (board: Pick<BoardState, 'pairCount' | 'tiles'> | null | undefined): number =>
    parTurnsForFloor(board?.pairCount ?? 0, boardPaletteWidth(board));

/** Turns the run has resolved on this floor, read from its own ledger. */
export const turnsTakenThisFloor = (run: Pick<RunState, 'turnsThisFloor'>): number =>
    runNonNegativeInteger(run.turnsThisFloor);

export const parTurnsForRun = (run: Pick<RunState, 'board'>): number => parTurnsForBoard(run.board);

/**
 * The turn ceiling (thesis §42.2). There are no lives; a run ends when a floor is not cleared
 * within three times its par. Three times par is a player missing two thirds of their flips: not
 * a difficulty gate but a floor under competence, there so that a run *can* end and be a story.
 * The run never ends because you forgot - it ends because you could not finish a board at all.
 */
export const TURN_CEILING_PAR_MULTIPLIER = 3;

export const turnCeilingForFloor = (pairs: number, suits?: number): number =>
    parTurnsForFloor(pairs, suits) * TURN_CEILING_PAR_MULTIPLIER;

/** The ceiling for a board, read off the board the same way its par is. */
export const turnCeilingForBoard = (board: Pick<BoardState, 'pairCount' | 'tiles'> | null | undefined): number =>
    parTurnsForBoard(board) * TURN_CEILING_PAR_MULTIPLIER;

export const turnCeilingForRun = (run: Pick<RunState, 'board'>): number => turnCeilingForBoard(run.board);

/** Turns left before the ceiling ends the run, never below zero. */
export const turnsToCeiling = (run: Pick<RunState, 'board' | 'turnsThisFloor'>): number =>
    Math.max(0, turnCeilingForRun(run) - turnsTakenThisFloor(run));

/** A floor still open on its ceiling turn ends the run. A floor that cleared on that turn is a clear. */
export const floorHitTurnCeiling = (run: Pick<RunState, 'board' | 'turnsThisFloor' | 'status'>): boolean =>
    run.status === 'playing' && run.board != null && turnsTakenThisFloor(run) >= turnCeilingForRun(run);
