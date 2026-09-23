/**
 * What the restless floor says when it shifts.
 *
 * A drift the player watched needs no words: two backs of different suits changed colour. A drift
 * they were looking away for - reading the HUD, watching a pop - is indistinguishable from
 * misremembering, and that turns the mutator into a bug report. So every drift is announced, with
 * how many pairs of cards moved, and never with where they went.
 */
const DRIFT_ANNOUNCEMENT = 'The floor shifted. {n} traded places somewhere on the board.';

const COUNT_WORDS = ['one', 'two', 'three', 'four', 'five'] as const;

/** "one pair of hidden cards", "two pairs of hidden cards", ... */
const driftCountPhrase = (swaps: number): string => {
    const n = Math.max(1, Math.floor(swaps));
    const word = COUNT_WORDS[n - 1] ?? String(n);
    return n === 1 ? `${word} pair of hidden cards` : `${word} pairs of hidden cards`;
};

/** Spoken to a screen reader and shown in the run log, where nothing on the board is visible to lean on. */
export const restlessDriftAnnouncement = (swaps: number): string =>
    DRIFT_ANNOUNCEMENT.replace('{n}', driftCountPhrase(swaps));
