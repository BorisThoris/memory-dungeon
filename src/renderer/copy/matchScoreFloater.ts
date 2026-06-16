/**
 * Match-score floater live region (`aria-live`). Centralized for a11y review and future i18n.
 */
export function matchScoreFloaterLiveRegionText(amount: number, traitInteractionTexts: readonly string[] = []): string {
    const base = `Plus ${amount.toLocaleString()} points`;
    return traitInteractionTexts.length > 0 ? `${base}. ${traitInteractionTexts.join('. ')}` : base;
}
