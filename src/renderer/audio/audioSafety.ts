/**
 * Sound is a garnish on an action, never a condition of it.
 *
 * Every click handler in this game opens with a cue call, so anything the audio layer throws is
 * thrown *before* the thing the player asked for. Web Audio throws for reasons that have nothing
 * to do with the press: `createOscillator` raises InvalidStateError on a closed AudioContext, and
 * browsers close contexts on their own under memory pressure or on a backgrounded page. That
 * turned a dead speaker into a dead menu — the Play button highlighted, the cue threw, and
 * Choose Your Path never opened.
 */

export const audioNeverThrows = (play: () => void): void => {
    try {
        play();
    } catch {
        /* A cue that cannot sound is silence, not a broken button. */
    }
};

/** The same guard for a cue that reports whether it played. A throw counts as "did not play". */
export const audioNeverThrowsBoolean = (play: () => boolean): boolean => {
    try {
        return play();
    } catch {
        return false;
    }
};
