import { describe, expect, it } from 'vitest';
import {
    COMBO_HEAT_STAGE_FROM,
    comboDepth,
    comboSoftCap,
    comboStageReached,
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

    it('calls out a stage the turn reached, from hot up, and never a stage it was already on', () => {
        expect(comboStageReached(5, 6)).toBe('hot');
        expect(comboStageReached(9, 10)).toBe('blazing');
        expect(comboStageReached(15, 16)).toBe('inferno');
        expect(comboStageReached(24, 25)).toBe('legendary');
        // A pop can jump a stage: the stamp is the stage arrived at.
        expect(comboStageReached(4, 11)).toBe('blazing');
        expect(comboStageReached(6, 7)).toBeNull();
        expect(comboStageReached(2, 3)).toBeNull();
        expect(comboStageReached(10, 0)).toBeNull();
        expect(comboStageReached(12, 12)).toBeNull();
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
            expect(levels.embers).toBeLessThanOrEqual(12);
            expect(Object.is(levels.hueDeg, -0)).toBe(false);
            previous = levels;
        }
        expect(comboHeatLevels(3).embers).toBe(0);
        expect(comboHeatLevels(6).embers).toBeGreaterThan(0);
    });
});

describe('combo depth', () => {
    it('rises with every link, with no plateau anywhere, and has no ceiling', () => {
        for (let links = 1; links <= 5000; links += 1) {
            expect(comboDepth(links)).toBeGreaterThan(comboDepth(links - 1));
        }
        // Across the old gap (heat level by forty, the surge only from the second ascension).
        expect(comboDepth(49) - comboDepth(40)).toBeGreaterThan(0.2);
        expect(comboDepth(1000)).toBeGreaterThan(comboDepth(100) + 3);
        expect(comboDepth(0)).toBe(0);
    });

    it('lets a budgeted surface keep rising toward its ceiling without reaching it', () => {
        let last = -1;
        for (let links = 0; links <= 5000; links += 25) {
            const share = comboSoftCap(comboDepth(links), 3);
            expect(share).toBeGreaterThan(last);
            expect(share).toBeLessThan(3);
            last = share;
        }
    });
});
