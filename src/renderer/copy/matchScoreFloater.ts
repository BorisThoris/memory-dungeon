/**
 * Match-score floater copy. The live region says exactly what the floater shows: what happened,
 * what it was worth, and the one reason worth naming. Centralized for a11y review and i18n.
 */
import { runNonNegativeInteger } from '../../shared/run-number-guards';
import { getChainMomentumCue } from './chainMomentum';

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
