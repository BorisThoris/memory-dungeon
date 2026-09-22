/**
 * A tap on a phone, through `navigator.vibrate`.
 *
 * `HAPTICS_POLICY` in `platformTiltMotion` has declared this channel — optional, a silent no-op
 * where it is unsupported, never carrying anything essential — since before anything used it.
 * This is the first thing that does, and it exists because of a hole the other two channels leave.
 *
 * The closing study window says so twice: the HUD bar reddens, and a tick sounds. Both miss the
 * same player. Memorizing means watching the board, so the bar is where they are not looking; and
 * a phone is very often muted, so the tick never plays. On a silenced phone held by someone doing
 * the thing correctly, the end of the window had no feedback at all. Touch is the channel that
 * reaches exactly that person, and only that person — a desktop browser without the API simply
 * does nothing.
 *
 * Reduce motion turns it off, as it does controller rumble. The setting is this game's one switch
 * for "less shaking", and a buzz in the hand is shaking. That does leave a reduce-motion player on
 * a muted phone with only the bar, which is the honest trade: the setting is a request, not an
 * oversight to route around.
 */
export type VibrateFn = (pattern: number | number[]) => boolean;

const defaultVibrate = (): VibrateFn | null => {
    try {
        if (typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
            return null;
        }
        return navigator.vibrate.bind(navigator) as VibrateFn;
    } catch {
        return null;
    }
};

/**
 * A single light tap. Short enough to read as a tick rather than a buzz — this fires inside the
 * player's concentration, so it has to be the smallest thing the hardware can say.
 */
export const STUDY_CLOSING_TAP_MS = 14;

/**
 * Taps the device once for a second of the closing study window. Returns whether it fired.
 *
 * Never throws: a browser without the API, a device that refuses the effect, and a page that has
 * not been interacted with yet are all silent no-ops, the same contract the gamepad rumble keeps.
 */
export const tapStudyClosing = (
    reduceMotion: boolean,
    options: { vibrate?: VibrateFn | null } = {}
): boolean => {
    if (reduceMotion) {
        return false;
    }
    const vibrate = options.vibrate === undefined ? defaultVibrate() : options.vibrate;
    if (!vibrate) {
        return false;
    }
    try {
        // Chrome returns false when it declines (no user gesture yet, or the page is hidden).
        return vibrate(STUDY_CLOSING_TAP_MS) !== false;
    } catch {
        return false;
    }
};
