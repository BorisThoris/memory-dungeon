import { describe, expect, it } from 'vitest';
import {
    COMBO_HEAT_STAGE_FROM,
    COMBO_HEAT_STAGE_LABELS,
    comboHeat,
    comboHeatLevels,
    comboHeatStage,
    comboHeatStageIndex
} from './combo-heat-rules';

describe('combo heat', () => {
    it('names six ascending stages by the combo alone', () => {
        expect(comboHeatStage(0)).toBe('cold');
        expect(comboHeatStage(COMBO_HEAT_STAGE_FROM.warm - 1)).toBe('cold');
        expect(comboHeatStage(COMBO_HEAT_STAGE_FROM.warm)).toBe('warm');
        expect(comboHeatStage(COMBO_HEAT_STAGE_FROM.hot)).toBe('hot');
        expect(comboHeatStage(COMBO_HEAT_STAGE_FROM.blazing)).toBe('blazing');
        expect(comboHeatStage(COMBO_HEAT_STAGE_FROM.inferno)).toBe('inferno');
        expect(comboHeatStage(COMBO_HEAT_STAGE_FROM.legendary)).toBe('legendary');
        expect(comboHeatStage(500)).toBe('legendary');
        const froms = Object.values(COMBO_HEAT_STAGE_FROM);
        expect([...froms].sort((a, b) => a - b)).toEqual(froms);
        for (const stage of ['cold', 'warm', 'hot', 'blazing', 'inferno', 'legendary'] as const) {
            expect(comboHeatStageIndex(stage)).toBe(['cold', 'warm', 'hot', 'blazing', 'inferno', 'legendary'].indexOf(stage));
            expect(COMBO_HEAT_STAGE_LABELS[stage]).toBeDefined();
        }
    });

    it('climbs with the combo, saturates, and reads junk as cold', () => {
        expect(comboHeat(0)).toBe(0);
        expect(comboHeat(3)).toBeLessThan(comboHeat(10));
        expect(comboHeat(10)).toBeLessThan(comboHeat(25));
        expect(comboHeat(1000)).toBeLessThanOrEqual(1);
        expect(comboHeat(Number.NaN)).toBe(0);
        expect(comboHeat(-4)).toBe(0);
        expect(comboHeatStage(Number.NaN)).toBe('cold');
    });

    it('turns every level up with the stage, and keeps them all bounded', () => {
        const cold = comboHeatLevels(0);
        expect(cold).toMatchObject({ stage: 'cold', stageIndex: 0, heat: 0, burn: 1, aura: 0, hueDeg: 0, embers: 0 });
        let previous = cold;
        for (const combo of [3, 6, 10, 16, 25, 40]) {
            const levels = comboHeatLevels(combo);
            expect(levels.stageIndex).toBeGreaterThan(previous.stageIndex === 5 ? 4 : previous.stageIndex);
            expect(levels.burn).toBeGreaterThan(previous.burn);
            expect(levels.aura).toBeGreaterThan(previous.aura);
            expect(levels.embers).toBeGreaterThanOrEqual(previous.embers);
            expect(levels.burn).toBeLessThanOrEqual(2.2);
            expect(levels.aura).toBeLessThanOrEqual(1);
            expect(levels.embers).toBeLessThanOrEqual(6);
            expect(Object.is(levels.hueDeg, -0)).toBe(false);
            previous = levels;
        }
        expect(comboHeatLevels(3).embers).toBe(0);
        expect(comboHeatLevels(6).embers).toBeGreaterThan(0);
    });
});
