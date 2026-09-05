/**
 * Two controls a player reads as the same instruction.
 *
 * The vendor shipped "Back to board" and "Return to board" side by side, running the same store
 * action, with the screen's own test asserting both were present. Handlers are inline closures, so
 * there is nothing to compare statically — but what a player experiences is two buttons that read
 * the same, and that is comparable.
 *
 * Only the gesture words are folded to a common token. The destination is left alone, so "Back to
 * board" and "Back to floor summary" stay distinct, as they should: those are two different places.
 */

/** Words that mean the same instruction to someone reading a button. */
export const CONTROL_LABEL_SYNONYMS: Record<string, string> = {
    back: 'back',
    return: 'back',
    leave: 'back',
    exit: 'back',
    continue: 'go',
    proceed: 'go',
    next: 'go',
    onward: 'go',
    close: 'close',
    dismiss: 'close',
    start: 'start',
    begin: 'start',
    play: 'start',
    retry: 'retry',
    again: 'retry',
    restart: 'retry'
};

export const normalizeControlLabel = (text: string): string =>
    text
        .toLowerCase()
        .replace(/[^a-z0-9 ]/gu, ' ')
        .split(/\s+/u)
        .filter((word) => word.length > 0)
        .map((word) => CONTROL_LABEL_SYNONYMS[word] ?? word)
        .join(' ');

/** Two labels that differ on screen but say the same thing. */
export const labelsAreAmbiguous = (left: string, right: string): boolean =>
    left !== right && normalizeControlLabel(left) === normalizeControlLabel(right);
