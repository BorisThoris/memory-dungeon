/**
 * Mismatch floater copy. A miss states one thing and one recovery, on the board and in the live
 * region alike. Centralized for a11y review and future i18n.
 */
import { tr } from '../../shared/i18n';
import { getChainTargetFeedback } from '../../shared/chain-targets';
import type { ChainTier } from '../../shared/chain-tier-rules';
import { runNonNegativeInteger } from '../../shared/run-number-guards';

type MismatchFloaterContext = {
    brokenChainDepth?: number;
    currentTier?: ChainTier;
};

const normalizeBrokenChainDepth = (context: MismatchFloaterContext = {}): number =>
    runNonNegativeInteger(context.brokenChainDepth);

/** The live region says exactly what the floater shows: the signal, then the one recovery line. */
export function mismatchFloaterLiveRegionText(signalLabel: string, reason?: string): string {
    const lead = signalLabel ? `${signalLabel}. ` : '';
    const detail = reason ? `. ${reason.replace(/[.!?]+$/u, '')}` : '';
    return tr`${lead}No match${detail}`;
}

/** Short recovery cue shown under the mismatch signal. */
export function mismatchFloaterRecoveryHint(traitInteractionTexts: readonly string[] = []): string | null {
    if (traitInteractionTexts.length === 0) {
        return tr.s('Recover - safe match');
    }
    const text = traitInteractionTexts.join(' ').toLowerCase();
    if (text.includes('buffered')) {
        return tr.s('Buffered - open a safe match');
    }
    if (text.includes('blocked') || text.includes('lock')) {
        return tr.s('Next - choose another opener');
    }
    return tr.s('Recover - prime with tools');
}

type MismatchFloaterSignal = {
    label: string;
    tone: 'miss' | 'penalty' | 'break';
};

/** Compact signal chip shown above mismatch floaters. */
export function mismatchFloaterSignal(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterSignal {
    if (traitInteractionTexts.length > 0) {
        return { label: tr.s('Risk'), tone: 'penalty' };
    }
    return normalizeBrokenChainDepth(context) >= 3 ? { label: tr.s('Break'), tone: 'break' } : { label: tr.s('Miss'), tone: 'miss' };
}

type MismatchFloaterNextAction = {
    arcadeCue: string;
    label: string;
    tone: 'recover' | 'risk';
    value: string;
};

/** The recovery the 3D board itself surfaces after a miss. */
export function mismatchFloaterNextAction(
    traitInteractionTexts: readonly string[] = [],
    context: MismatchFloaterContext = {}
): MismatchFloaterNextAction {
    const brokenChainDepth = normalizeBrokenChainDepth(context);
    if (brokenChainDepth >= 2) {
        return {
            arcadeCue: tr.s('Rebuild chase'),
            label: tr.s('Rebuild chain'),
            value: getChainTargetFeedback(brokenChainDepth, context.currentTier).value,
            tone: 'risk'
        };
    }
    if (traitInteractionTexts.length > 0) {
        return {
            arcadeCue: tr.s('Recover route'),
            label: tr.s('Recover route'),
            value: (mismatchFloaterRecoveryHint(traitInteractionTexts) ?? tr.s('Recover - prime with tools'))
                .replace(/^Recover - /u, '')
                .replace(/^Next - /u, ''),
            tone: 'risk'
        };
    }
    return {
        arcadeCue: tr.s('Safe pair'),
        label: tr.s('Recover now'),
        value: tr.s('Safe match'),
        tone: 'recover'
    };
}
