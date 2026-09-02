/**
 * Mismatch floater copy. A miss states one thing and one recovery, on the board and in the live
 * region alike. Centralized for a11y review and future i18n.
 */
import { getChainTargetFeedback } from '../../shared/chain-targets';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

type MismatchFloaterContext = {
    brokenChainDepth?: number;
    brokenChainRewardCue?: {
        distanceLabel: string;
        label: string;
    };
};

const normalizeBrokenChainDepth = (context: MismatchFloaterContext = {}): number =>
    runNonNegativeInteger(context.brokenChainDepth);

/** The live region says exactly what the floater shows: the signal, then the one recovery line. */
export function mismatchFloaterLiveRegionText(signalLabel: string, reason?: string): string {
    const lead = signalLabel ? `${signalLabel}. ` : '';
    const detail = reason ? `. ${reason.replace(/[.!?]+$/u, '')}` : '';
    return `${lead}No match${detail}`;
}

/** Short recovery cue shown under the mismatch signal. */
export function mismatchFloaterRecoveryHint(traitInteractionTexts: readonly string[] = []): string | null {
    if (traitInteractionTexts.length === 0) {
        return 'Recover - safe match';
    }
    const text = traitInteractionTexts.join(' ').toLowerCase();
    if (text.includes('buffered')) {
        return 'Buffered - open a safe match';
    }
    if (text.includes('blocked') || text.includes('lock')) {
        return 'Next - choose another opener';
    }
    if (text.includes('volatile') || text.includes('cursed')) {
        return 'Recover - peek or route away';
    }
    if (text.includes('sealed')) {
        return 'Recover - peek before Sealed';
    }
    return 'Recover - prime with tools';
}

type MismatchFloaterSignal = {
    label: 'Miss' | 'Risk' | 'Break';
    tone: 'miss' | 'penalty' | 'break';
};

/** Compact signal chip shown above mismatch floaters. */
export function mismatchFloaterSignal(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterSignal {
    if (traitInteractionTexts.length > 0) {
        return { label: 'Risk', tone: 'penalty' };
    }
    return normalizeBrokenChainDepth(context) >= 3 ? { label: 'Break', tone: 'break' } : { label: 'Miss', tone: 'miss' };
}

type MismatchFloaterNextAction = {
    arcadeCue: string;
    label: string;
    tone: 'recover' | 'risk' | 'lost-reward';
    value: string;
};

/** The recovery the 3D board itself surfaces after a miss. */
export function mismatchFloaterNextAction(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterNextAction {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    if (brokenChainDepth >= 2 && context.brokenChainRewardCue) {
        return {
            arcadeCue: 'Save cashout',
            label: 'Save streak',
            value: `Rebuild toward ${context.brokenChainRewardCue.label}`,
            tone: 'lost-reward'
        };
    }
    if (brokenChainDepth >= 2) {
        return {
            arcadeCue: 'Rebuild chase',
            label: 'Rebuild chain',
            value: getChainTargetFeedback(brokenChainDepth).value,
            tone: 'risk'
        };
    }
    if (traitInteractionTexts.length > 0) {
        return {
            arcadeCue: 'Recover route',
            label: 'Recover route',
            value: (mismatchFloaterRecoveryHint(traitInteractionTexts) ?? 'Recover - prime with tools')
                .replace(/^Recover - /u, '')
                .replace(/^Next - /u, ''),
            tone: 'risk'
        };
    }
    return {
        arcadeCue: 'Safe pair',
        label: 'Recover now',
        value: 'Safe match',
        tone: 'recover'
    };
}
