import { tr } from './i18n';
import type { ElementReactionImpact } from './contracts';

/** Actual results only: potential recipe effects belong in the preview, not the receipt. */
export function elementReactionResult(impact: ElementReactionImpact): string {
    const effects = ['doused', 'revealed', 'growth-cleared', 'thawed', 'ripened', 'charged'] as const;
    const labels = { doused: 'doused', revealed: 'revealed', 'growth-cleared': tr.s('growth cleared'), thawed: 'thawed', ripened: 'ripened', charged: 'charged' };
    const parts = effects.flatMap(effect => {
        const count = new Set(impact.changes.filter(change => change.effect === effect).map(change => change.tileId)).size;
        return count ? [`${count} ${labels[effect]}`] : [];
    });
    if (impact.gold) parts.push(tr`+${impact.gold} gold`);
    if (impact.score) parts.push(tr`+${impact.score} score`);
    if (impact.stillTurns) parts.push(tr`${impact.stillTurns} calm turns`);
    if (impact.resonanceGain) parts.push(tr`+${impact.resonanceGain} Water & Grove`);
    return parts.join(' · ') || tr.s('No cards changed');
}
