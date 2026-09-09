/**
 * Match-score floater copy. The live region says exactly what the floater shows: what happened,
 * what it was worth, and the one reason worth naming. Centralized for a11y review and i18n.
 */
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { getChainMomentumCue } from './chainMomentum';
import { CHAIN_TIER_LABELS } from './chainBeat';
import type { BreakScoreBreakdown, ScoreTerm } from '../../shared/score-terms-rules';

export const matchScoreFloaterChainCue = getChainMomentumCue;

interface MatchScoreFloaterLiveOptions {
    chainDepth?: number;
    headline?: string;
    /** The single line the floater shows under the amount. */
    reason?: string;
}

export function matchScoreFloaterLiveRegionText(
    amount: number,
    { chainDepth, headline, reason }: MatchScoreFloaterLiveOptions = {}
): string {
    const lead = headline ? `${headline}. ` : '';
    const points = `Plus ${runNonNegativeInteger(amount).toLocaleString()} points`;
    const depth = chainDepth == null ? 0 : runNonNegativeInteger(chainDepth);
    const streak = depth >= 3 ? `. ${depth} match streak` : '';
    const detail = reason ? `. ${reason.replace(/[.!?]+$/u, '')}` : '';
    return `${lead}${points}${streak}${detail}`;
}

/** A multiplier as the player reads it: whole where it is whole, two places where it is not. */
const formatMultiplier = (factor: number): string =>
    Number.isInteger(factor) ? String(factor) : String(Number(factor.toFixed(2)));

/**
 * One term of the break's score. Thesis §40.4: the multiplier is shown as it is applied, so the
 * player watches `4 pairs × Clean ×2 × Ripple ×2.5` being built rather than meeting its product.
 */
export function scoreTermLabel(term: ScoreTerm): string {
    if (term.id === 'pairs') {
        return `${term.factor} ${term.factor === 1 ? 'pair' : 'pairs'}`;
    }
    if (term.id === 'tier') {
        return `${CHAIN_TIER_LABELS[term.tier ?? 'none']} ×${formatMultiplier(term.factor)}`;
    }
    return `Ripple ×${formatMultiplier(term.factor)}`;
}

/** The whole line, for a screen reader: the terms in order, and what they came to. */
export function scoreTermsLiveRegionText(breakdown: BreakScoreBreakdown): string {
    const terms = breakdown.terms.map(scoreTermLabel).join(' times ');
    return `Break score: ${terms}, ${breakdown.total.toLocaleString()} points.`;
}
