import type { BoardState } from './contracts';

/**
 * The shorter Descent (rules 93, 2026-10-25): forty floors to the Warden, not sixty.
 *
 * The owner, asked how progress should be faster, chose a shorter Descent: the Living Dungeon from floor 9,
 * the Deep from 17, the Abyss from 27 and the Warden on 40. A player who keeps eight to twelve cards in mind
 * ends a run around floor 9 to 21 (`yarn sim:memory-survival`), so with sixty floors most runs met one act.
 *
 * Everything the Descent deals was written against sixty floors - the schedule's rooms, the act bosses, the
 * families' first floors, the Spirals, the Warden. Rather than renumber each, a run from rules 93 plays its
 * floors as forty *content floors* picked from those sixty: each act's first floor and boss, both boss
 * slots of every cycle (positions 7 and 9), the Spirals and every family's first and third floors are kept,
 * and the rest of each act is thinned. The floor number the player sees, the board's size (`pair-curve.ts`),
 * the Dread, the miss bank and every record read the real floor; what is dealt reads the content floor
 * (`contentFloor`). Past floor 40 Endless goes on where floor 61 did.
 */
export const DESCENT_STRIDE_FROM = 93;

/** The content floor of each of the forty, in order: the Gate 1-8, the Living Dungeon 9-16, the Deep 17-26, the Abyss 27-40. */
export const STRIDE_CONTENT_FLOORS: readonly number[] = [
    // The Gate: the three authored floors, the Hold (5), the first breather (6), the boss slot (7), the rotating slot (9).
    1, 2, 3, 4, 5, 6, 7, 9,
    // The Living Dungeon: its first floor, its boss slot (19) and rotating slot (21), the Keeper (24).
    13, 14, 16, 17, 19, 21, 23, 24,
    // The Deep: its first floor and third Wanderer (25), the boss slot (31), the rotating slot and third mask (33), the Cartographer (40).
    25, 26, 28, 29, 31, 33, 35, 37, 39, 40,
    // The Abyss: its first floor (41), the Spirals (44, 56), the rotating slots (45, 57), the third Sleeper (51), the Warden (60).
    41, 42, 44, 45, 46, 48, 50, 51, 52, 54, 56, 57, 59, 60
];

/** Sixty floors before rules 93, forty from it. */
export const CLASSIC_DESCENT_LENGTH = 60;
export const STRIDE_DESCENT_LENGTH = STRIDE_CONTENT_FLOORS.length;

const strides = (rulesVersion: number | undefined): boolean => (rulesVersion ?? 0) >= DESCENT_STRIDE_FROM;

/** The Descent's length, the Warden's floor, for this run. */
export const descentLengthFor = (rulesVersion: number | undefined): number => (strides(rulesVersion) ? STRIDE_DESCENT_LENGTH : CLASSIC_DESCENT_LENGTH);

/** What a floor deals as: itself before rules 93; from it one of the forty, and past the Warden the Endless floor sixty would reach. */
export const descentFloorFor = (level: number, rulesVersion: number | undefined): number => {
    const floor = Math.max(1, Math.floor(Number.isFinite(level) ? level : 1));
    if (!strides(rulesVersion)) return floor;
    return floor <= STRIDE_DESCENT_LENGTH ? STRIDE_CONTENT_FLOORS[floor - 1]! : floor + (CLASSIC_DESCENT_LENGTH - STRIDE_DESCENT_LENGTH);
};

/** The first real floor that deals content floor `descentFloor` or a later one: where a thing written for sixty floors arrives. */
export const levelForDescentFloor = (descentFloor: number, rulesVersion: number | undefined): number => {
    if (!strides(rulesVersion)) return descentFloor;
    if (descentFloor > CLASSIC_DESCENT_LENGTH) return descentFloor - (CLASSIC_DESCENT_LENGTH - STRIDE_DESCENT_LENGTH);
    const index = STRIDE_CONTENT_FLOORS.findIndex((floor) => floor >= descentFloor);
    return index < 0 ? STRIDE_DESCENT_LENGTH : index + 1;
};

/** The last real floor that deals content floor `descentFloor` or an earlier one: where a span written for sixty floors ends. */
export const lastLevelForDescentFloor = (descentFloor: number, rulesVersion: number | undefined): number => {
    if (!strides(rulesVersion)) return descentFloor;
    if (descentFloor > CLASSIC_DESCENT_LENGTH) return descentFloor - (CLASSIC_DESCENT_LENGTH - STRIDE_DESCENT_LENGTH);
    let last = 1;
    STRIDE_CONTENT_FLOORS.forEach((floor, index) => {
        if (floor <= descentFloor) last = index + 1;
    });
    return last;
};

/** The floor a board deals as: its content floor when it was dealt on the shorter Descent, else its own number. */
export const contentFloor = (board: Pick<BoardState, 'level'> & Partial<Pick<BoardState, 'descentFloor'>>): number => board.descentFloor ?? board.level;

/** The last rules on the sixty-floor numbering: where a test or a hall room names a floor its content was written for. */
export const CLASSIC_DESCENT_RULES = DESCENT_STRIDE_FROM - 1;
