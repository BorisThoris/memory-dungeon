import { tr } from '../../shared/i18n';
import type { ComboHeatPerks } from '../../shared/combo-heat-perks';

/**
 * The line under the combo that says what the fire is buying on the board, or how far the next
 * perk is (`combo-heat-perks.ts`). Short by design: the rail has one line for it.
 */
export const comboHeatPerksLine = (perks: ComboHeatPerks, nextAt: number | null): string | null => {
    const parts: string[] = [];
    if (perks.afterglow > 0) parts.push(tr`Reveal +${perks.afterglow}`);
    if (perks.breakPairBonus > 0) parts.push(tr`Pop +${perks.breakPairBonus}`);
    if (perks.breakReachBonus > 0) parts.push(tr`Reach +${perks.breakReachBonus}`);
    if (parts.length > 0) return parts.join(' · ');
    return nextAt == null ? null : tr`Reveal at ${nextAt}`;
};
