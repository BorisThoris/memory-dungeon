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

/** A press of a tool in the dock: the same tick, a touch firmer, because the player asked for it. */
export const TOOL_PRESS_TAP_MS = 18;

/** Below this trauma an item effect is a flourish, and its press has already said so. */
export const ITEM_IMPACT_MIN_TRAUMA = 0.5;

/** The buzz of an item that hits the board, from the trauma it adds: a bomb under a meteor. */
export const itemImpactBuzzMs = (trauma: number): number => Math.round(20 + Math.min(1, trauma) * 40);

type TapOptions = { vibrate?: VibrateFn | null };

/**
 * Never throws: a browser without the API, a device that refuses the effect, and a page that has
 * not been interacted with yet are all silent no-ops, the same contract the gamepad rumble keeps.
 */
const tap = (reduceMotion: boolean, ms: number, options: TapOptions): boolean => {
    if (reduceMotion) {
        return false;
    }
    const vibrate = options.vibrate === undefined ? defaultVibrate() : options.vibrate;
    if (!vibrate) {
        return false;
    }
    try {
        // Chrome returns false when it declines (no user gesture yet, or the page is hidden).
        return vibrate(ms) !== false;
    } catch {
        return false;
    }
};

/** Taps the device once for a second of the closing study window. Returns whether it fired. */
export const tapStudyClosing = (reduceMotion: boolean, options: TapOptions = {}): boolean =>
    tap(reduceMotion, STUDY_CLOSING_TAP_MS, options);

/** Taps the device for a press of a dock tool. Returns whether it fired. */
export const tapToolPress = (reduceMotion: boolean, options: TapOptions = {}): boolean =>
    tap(reduceMotion, TOOL_PRESS_TAP_MS, options);

/** Buzzes the device as an item lands on the board, if it lands hard enough. Returns whether it fired. */
export const tapItemImpact = (reduceMotion: boolean, trauma: number, options: TapOptions = {}): boolean =>
    trauma >= ITEM_IMPACT_MIN_TRAUMA && tap(reduceMotion, itemImpactBuzzMs(trauma), options);
