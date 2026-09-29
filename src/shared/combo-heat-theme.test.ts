import { describe, expect, it } from 'vitest';
import {
    COMBO_HEAT_THEMES,
    COMBO_MILESTONE_CALLOUT,
    comboHeatThemeForSeed,
    comboMilestoneReached
} from './combo-heat-rules';

describe('the temper of a run', () => {
    it('is rolled from the seed, the same seed the same temper, at the weights written down', () => {
        expect(COMBO_HEAT_THEMES.reduce((sum, theme) => sum + theme.weight, 0)).toBe(100);
        const counts = new Map<string, number>();
        for (let seed = 1; seed <= 4000; seed += 1) {
            const theme = comboHeatThemeForSeed(seed);
            expect(comboHeatThemeForSeed(seed)).toBe(theme);
            counts.set(theme.id, (counts.get(theme.id) ?? 0) + 1);
        }
        for (const theme of COMBO_HEAT_THEMES) {
            const share = (counts.get(theme.id) ?? 0) / 4000;
            expect(share, theme.id).toBeGreaterThan(theme.weight / 100 - 0.03);
            expect(share, theme.id).toBeLessThan(theme.weight / 100 + 0.03);
        }
        // The shiny is the only rare one, and it is the rarest.
        expect(COMBO_HEAT_THEMES.filter((theme) => theme.rare).map((theme) => theme.id)).toEqual(['prismatic']);
        expect(Math.min(...COMBO_HEAT_THEMES.map((theme) => theme.weight))).toBe(COMBO_HEAT_THEMES.find((theme) => theme.rare)!.weight);
        expect(comboHeatThemeForSeed(Number.NaN).id).toBe(comboHeatThemeForSeed(0).id);
    });

    it('names every stage and stamp in every temper, with a colour per stage', () => {
        for (const theme of COMBO_HEAT_THEMES) {
            expect(theme.labels.cold).toBe('');
            for (const stage of ['warm', 'hot', 'blazing', 'inferno', 'legendary'] as const) expect(theme.labels[stage], `${theme.id} ${stage}`).not.toBe('');
            for (const stage of ['hot', 'blazing', 'inferno', 'legendary'] as const) expect(theme.callouts[stage], `${theme.id} ${stage}`).toMatch(/!$/);
            expect(theme.colors).toHaveLength(6);
            expect(theme.arcTints).toHaveLength(4);
            for (const color of [...theme.colors, ...theme.arcTints]) expect(color).toMatch(/^#[0-9a-f]{6}$/i);
        }
        // Frost goes the other way: its things fall.
        expect(COMBO_HEAT_THEMES.find((theme) => theme.id === 'frost')!.emberMode).toBe('fall');
    });

    it('stamps the half-century, the century and every hundred after, once each', () => {
        expect(comboMilestoneReached(49, 50)).toBe(50);
        expect(comboMilestoneReached(48, 53)).toBe(50);
        expect(comboMilestoneReached(50, 51)).toBeNull();
        expect(comboMilestoneReached(99, 100)).toBe(100);
        expect(comboMilestoneReached(199, 201)).toBe(200);
        expect(comboMilestoneReached(10, 0)).toBeNull();
        expect(comboMilestoneReached(1, 2)).toBeNull();
        expect(COMBO_MILESTONE_CALLOUT(50)).toBe('HALF-CENTURY!');
        expect(COMBO_MILESTONE_CALLOUT(100)).toBe('CENTURY!');
        expect(COMBO_MILESTONE_CALLOUT(300)).toBe('300 COMBO!');
    });
});
