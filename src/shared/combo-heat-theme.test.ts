import { describe, expect, it } from 'vitest';
import {
    COMBO_HEAT_THEMES,
    COMBO_MILESTONE_CALLOUT,
    comboAscension,
    comboAscensionCallout,
    comboAscensionReached,
    comboHeatLevels,
    PRISMATIC_WORLD_CHANCE,
    runTemper,
    temperForWorld,
    comboMilestoneReached,
    comboStageLabel,
    comboSurge,
    romanNumeral
} from './combo-heat-rules';

describe('the ladder past its top', () => {
    it('ascends every twenty-five links after Legendary, without end', () => {
        expect(comboAscension(24)).toBe(0);
        expect(comboAscension(25)).toBe(1);
        expect(comboAscension(49)).toBe(1);
        expect(comboAscension(50)).toBe(2);
        expect(comboAscension(1000)).toBe(40);
        expect(comboAscensionReached(24, 25)).toBeNull();
        expect(comboAscensionReached(49, 50)).toBe(2);
        expect(comboAscensionReached(74, 80)).toBe(3);
        expect(comboAscensionReached(50, 60)).toBeNull();
        expect(comboSurge(25)).toBe(0);
        expect(comboSurge(50)).toBe(1);
        expect(comboSurge(100)).toBe(2);
        expect(comboSurge(10_000)).toBeGreaterThan(comboSurge(1_000));
        expect(comboHeatLevels(1000).embers).toBe(12);
        expect(comboHeatLevels(1000).surge).toBeGreaterThan(comboHeatLevels(100).surge);
    });

    it('names the ascensions in numerals, on any temper', () => {
        expect(romanNumeral(2)).toBe('II');
        expect(romanNumeral(4)).toBe('IV');
        expect(romanNumeral(40)).toBe('XL');
        const ember = COMBO_HEAT_THEMES[0]!;
        expect(comboStageLabel(ember.labels, 25)).toBe('Legendary');
        expect(comboStageLabel(ember.labels, 50)).toBe('Legendary II');
        expect(comboStageLabel(ember.labels, 6)).toBe('Hot');
        expect(comboAscensionCallout(ember.callouts.legendary, 3)).toBe('LEGENDARY III!');
        const frost = COMBO_HEAT_THEMES.find((theme) => theme.id === 'frost')!;
        expect(comboAscensionCallout(frost.callouts.legendary, 2)).toBe('ABSOLUTE ZERO II!');
    });
});

describe('the temper of a run', () => {
    it('is not rolled at the door: every run starts in the plain dungeon, ember, whatever its seed', () => {
        for (let seed = 1; seed <= 200; seed += 1) expect(runTemper({ runSeed: seed, world: [] }).id).toBe('ember');
        expect(runTemper({ runSeed: 14 }).id).toBe('ember');
    });

    it('follows the world the pops made: its latest element, the same world the same temper', () => {
        const plain = (world: Parameters<typeof temperForWorld>[0]) => {
            // A seed whose worlds are not the shiny, so the mapping itself is what is read.
            for (let seed = 1; seed < 500; seed += 1) {
                const theme = temperForWorld(world, seed);
                if (!theme.rare) return theme.id;
            }
            return 'none';
        };
        expect(plain(['ember'])).toBe('ember');
        expect(plain(['tide'])).toBe('storm');
        expect(plain(['bone'])).toBe('frost');
        expect(plain(['moss'])).toBe('moss');
        expect(plain(['bone', 'tide'])).toBe('storm');
        expect(temperForWorld(['tide'], 7)).toBe(temperForWorld(['tide'], 7));
    });

    it('makes a world prismatic about one time in fifty, and only a world, never the plain dungeon', () => {
        let shiny = 0;
        for (let seed = 1; seed <= 4000; seed += 1) if (temperForWorld(['moss'], seed).rare) shiny += 1;
        expect(shiny / 4000).toBeGreaterThan(PRISMATIC_WORLD_CHANCE - 0.012);
        expect(shiny / 4000).toBeLessThan(PRISMATIC_WORLD_CHANCE + 0.012);
        expect(COMBO_HEAT_THEMES.filter((theme) => theme.rare).map((theme) => theme.id)).toEqual(['prismatic']);
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

    it('stamps the century and every hundred after, once each', () => {
        expect(comboMilestoneReached(49, 50)).toBeNull();
        expect(comboMilestoneReached(50, 51)).toBeNull();
        expect(comboMilestoneReached(99, 100)).toBe(100);
        expect(comboMilestoneReached(199, 201)).toBe(200);
        expect(comboMilestoneReached(10, 0)).toBeNull();
        expect(comboMilestoneReached(1, 2)).toBeNull();
        expect(COMBO_MILESTONE_CALLOUT(100)).toBe('CENTURY!');
        expect(COMBO_MILESTONE_CALLOUT(300)).toBe('300 COMBO!');
    });
});
