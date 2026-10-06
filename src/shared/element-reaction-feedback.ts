import type { ElementReactionImpact } from './contracts';

/** Actual results only: potential recipe effects belong in the preview, not the receipt. */
export function elementReactionResult(impact: ElementReactionImpact): string {
    const effects = ['doused', 'revealed', 'growth-cleared', 'thawed', 'ripened', 'charged'] as const;
    const labels = { doused: 'doused', revealed: 'revealed', 'growth-cleared': 'growth cleared', thawed: 'thawed', ripened: 'ripened', charged: 'charged' };
    const parts = effects.flatMap(effect => {
        const count = new Set(impact.changes.filter(change => change.effect === effect).map(change => change.tileId)).size;
        return count ? [`${count} ${labels[effect]}`] : [];
    });
    if (impact.gold) parts.push(`+${impact.gold} gold`);
    if (impact.score) parts.push(`+${impact.score} score`);
    if (impact.stillTurns) parts.push(`${impact.stillTurns} calm turns`);
    if (impact.resonanceGain) parts.push(`+${impact.resonanceGain} Water & Grove`);
    return parts.join(' · ') || 'No cards changed';
}
