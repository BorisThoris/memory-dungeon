/**
 * What the magpie says when it visits.
 *
 * The theft has to be announced or it is indistinguishable from the player misremembering, which
 * turns the joke into a bug report: a pair moves, they look where it was, it is not there, and the
 * only explanation available to them is that their memory failed. The line is the difference
 * between "the game cheated" and "the bird got me".
 *
 * It never names the pair or where it went. Saying that would hand back exactly what was taken.
 */
export const MAGPIE_BEAT_COPY = {
    /** Shown on the board the moment a pair is lifted. */
    theftTitle: 'The magpie has been',
    theftBody: 'A pair you had cleared is face down again, somewhere else.',
    /** The run line, which is one sentence and has to carry the whole event. */
    theftLine: 'The magpie took a pair you had already found.',
    /** Spoken to a screen reader, where nothing on the board is visible to lean on. */
    theftAnnouncement: 'The magpie took back a pair you had already matched and hid it somewhere else on the board.',

    /** A guard token was spent, which the player has to be told or they will never hold one again. */
    scaredTitle: 'The magpie thought better of it',
    scaredBody: 'Your guard token saw it off. It cost you the token.',
    scaredLine: 'A guard token drove the magpie off.',
    scaredAnnouncement: 'A guard token drove the magpie off. The token is spent and nothing was taken.'
} as const;
