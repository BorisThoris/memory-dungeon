import { tr } from '../../../shared/i18n';
/**
 * Pair-distance assist copy (centralized for future i18n).
 * @see REF-081
 */
export const pairProximityUiStrings = {
    settingsLabel: tr.s('Pair distance hints'),
    settingsHint:
        tr.s('On a flip, shows grid steps (Manhattan) to the nearest tile that can complete the pair. Off for a purer memory read.'),
    /** Announced with focused tile when assist is on (matches WebGL badge). */
    focusPairSteps: (steps: number): string =>
        tr` Pair distance: ${steps} grid steps to the nearest tile that can complete the pair.`
} as const;

/**
 * Pseudo-locale: duplicate letters to stress layout overflow regressions (tests only).
 */
export const stretchPairProximityUiForPseudoLocale = (
    s: typeof pairProximityUiStrings = pairProximityUiStrings
): {
    settingsLabel: string;
    settingsHint: string;
    focusPairSteps: typeof pairProximityUiStrings.focusPairSteps;
} => ({
    focusPairSteps: s.focusPairSteps,
    settingsHint: s.settingsHint.replace(/[a-z]/gi, (ch) => `${ch}${ch}`),
    settingsLabel: s.settingsLabel.replace(/[a-z]/gi, (ch) => `${ch}${ch}`)
});
