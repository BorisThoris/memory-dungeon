/**
 * Mismatch floater live region (`aria-live`). Centralized for a11y review and future i18n.
 */
export function mismatchFloaterLiveRegionText(traitInteractionTexts: readonly string[] = []): string {
    return traitInteractionTexts.length > 0 ? `No match. ${traitInteractionTexts.join('. ')}` : 'No match';
}

/** Visible label on the board-stage floater (`aria-hidden`); keep short for layout. */
export function mismatchFloaterVisualLabel(): string {
    return 'Miss';
}
