import { describe, expect, it } from 'vitest';
import { COMBO_HEAT_STAGE_FROM } from './combo-heat-rules';
import { COMBO_HEAT_PERKS, comboHeatPerks, comboHeatPerksActive, nextComboHeatPerkAt, runComboHeatPerks } from './combo-heat-perks';
import { LANTERN_MAX_LIT } from './lantern-light-rules';
import { comboHeatPerksLine } from '../renderer/copy/comboHeatPerksCopy';

describe('what the heat buys on the board', () => {
    it('buys nothing cold or warm, the afterglow from Hot, the wider pop from Blazing, the reach from Inferno', () => {
        expect(comboHeatPerks(0)).toEqual({ stage: 'cold', afterglow: 0, breakPairBonus: 0, breakReachBonus: 0 });
        expect(comboHeatPerksActive(comboHeatPerks(COMBO_HEAT_STAGE_FROM.warm))).toBe(false);
        expect(comboHeatPerks(COMBO_HEAT_STAGE_FROM.hot)).toMatchObject({ afterglow: 1, breakPairBonus: 0, breakReachBonus: 0 });
        expect(comboHeatPerks(COMBO_HEAT_STAGE_FROM.blazing)).toMatchObject({ afterglow: 2, breakPairBonus: 1, breakReachBonus: 0 });
        expect(comboHeatPerks(COMBO_HEAT_STAGE_FROM.inferno)).toMatchObject({ afterglow: 3, breakPairBonus: 1, breakReachBonus: 1 });
        // Legendary buys no wider pop than Inferno: measured, a second pair let the pop take the board.
        expect(comboHeatPerks(COMBO_HEAT_STAGE_FROM.legendary)).toMatchObject({ afterglow: 3, breakPairBonus: 1, breakReachBonus: 1 });
        // An ascension keeps Legendary's perks: the ladder past the top is presentation, the board stays legible.
        expect(comboHeatPerks(1000)).toEqual(comboHeatPerks(25));
    });

    it('never lights more than the lantern can, and never steps down as the combo climbs', () => {
        const stages = ['cold', 'warm', 'hot', 'blazing', 'inferno', 'legendary'] as const;
        for (let index = 1; index < stages.length; index += 1) {
            const below = COMBO_HEAT_PERKS[stages[index - 1]!];
            const here = COMBO_HEAT_PERKS[stages[index]!];
            expect(here.afterglow).toBeGreaterThanOrEqual(below.afterglow);
            expect(here.breakPairBonus).toBeGreaterThanOrEqual(below.breakPairBonus);
            expect(here.breakReachBonus).toBeGreaterThanOrEqual(below.breakReachBonus);
            expect(here.afterglow).toBeLessThanOrEqual(LANTERN_MAX_LIT);
        }
    });

    it('reads the combo the run carries in, and a save from before the perks as cold', () => {
        expect(runComboHeatPerks({ stats: { currentStreak: 12 } as never }).stage).toBe('blazing');
        expect(runComboHeatPerks({}).stage).toBe('cold');
        expect(runComboHeatPerks({ stats: { currentStreak: -3 } as never }).stage).toBe('cold');
    });

    it('says where the next perk is, and nothing past the top', () => {
        expect(nextComboHeatPerkAt(0)).toBe(COMBO_HEAT_STAGE_FROM.hot);
        expect(nextComboHeatPerkAt(6)).toBe(COMBO_HEAT_STAGE_FROM.blazing);
        expect(nextComboHeatPerkAt(16)).toBeNull();
        expect(nextComboHeatPerkAt(25)).toBeNull();
        expect(comboHeatPerksLine(comboHeatPerks(0), 6)).toBe('Reveal at 6');
        expect(comboHeatPerksLine(comboHeatPerks(16), 25)).toBe('Reveal +3 · Pop +1 · Reach +1');
        expect(comboHeatPerksLine(comboHeatPerks(25), null)).toBe('Reveal +3 · Pop +1 · Reach +1');
    });
});
