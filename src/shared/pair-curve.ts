/**
 * The pair-count curve: how many pairs a floor deals.
 *
 * The curve used to be linear - one more pair every floor - which is too steep. Memory difficulty
 * is superlinear in board size because every extra pair interferes with every pair already there,
 * so a linear curve reaches the gruelling end (two dozen pairs, four dozen tiles) by floor thirty.
 * It also started too small: a two-pair floor cannot pop at all, and a pop needs two pairs of a
 * suit within reach, so the first floors of a run could not show the loop the game is built on.
 *
 * Square-root-tempered growth fixes both ends. Floor 1 opens with three pairs, floor 2 with six,
 * and the curve then climbs slowly enough that floor 50 is twenty-one pairs. The first three
 * floors are authored around these sizes (`authored-floors.ts`); floor 4 on is procedural on the
 * curve. Thesis §32.2.
 */
export const PAIRS_BASE = 3;
export const PAIRS_GROWTH = 2.6;
export const PAIRS_MAX = 24;
export const PAIRS_MIN = 2;

export const pairsForFloor = (level: number): number => {
    const floor = Number.isNaN(level) ? 1 : Math.max(1, Math.floor(level));
    const raw = Math.round(PAIRS_BASE + PAIRS_GROWTH * Math.sqrt(floor - 1));
    return Math.min(PAIRS_MAX, Math.max(PAIRS_MIN, raw));
};
