import { describe, expect, it } from 'vitest';
import {
    CHOOSE_PATH_HERO_MODE_IDS,
    RUN_MODE_CATALOG,
    RUN_MODE_GROUP_ORDER,
    choosePathHeroModes,
    choosePathLibraryModes,
    getRunModeChallengeGateRows,
    getRunModeDefinition,
    runModesByGroup
} from './run-mode-catalog';
import { createDefaultSaveData } from './save-data';

describe('REG-018 run mode shipping states', () => {
    it('keeps catalog ids unique and every shipped group reachable', () => {
        const ids = RUN_MODE_CATALOG.map((mode) => mode.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(RUN_MODE_GROUP_ORDER.flatMap((group) => runModesByGroup(group).map((mode) => mode.id))).toEqual(ids);
        expect(RUN_MODE_GROUP_ORDER.every((group) => runModesByGroup(group).length > 0)).toBe(true);
    });

    it('partitions hero and library modes through catalog-backed lookup', () => {
        const heroIds = new Set<string>(CHOOSE_PATH_HERO_MODE_IDS);
        expect(CHOOSE_PATH_HERO_MODE_IDS.map((id) => getRunModeDefinition(id)?.id)).toEqual([
            ...CHOOSE_PATH_HERO_MODE_IDS
        ]);
        expect(getRunModeDefinition('missing_mode')).toBeNull();
        expect(choosePathHeroModes().map((mode) => mode.id)).toEqual([...CHOOSE_PATH_HERO_MODE_IDS]);
        expect(choosePathLibraryModes().map((mode) => mode.id)).toEqual(
            RUN_MODE_CATALOG.map((mode) => mode.id).filter((id) => !heroIds.has(id))
        );
    });

});


describe('REG-050 mode identity copy', () => {

    it('gives every catalog mode one stable start-contract identity signal', () => {
        const missing = RUN_MODE_CATALOG.filter((mode) => !mode.startContract);
        expect(missing).toEqual([]);

        for (const mode of RUN_MODE_CATALOG) {
            expect(mode.startContract?.label).toBe('Start signal');
            expect(mode.startContract?.signal).toMatch(/\S/);
            expect(mode.startContract?.testId).toMatch(/\S/);
        }
    });
});

describe('REG-081 challenge mode gates', () => {
    it('exposes offline challenge progression gates from the mode catalog', () => {
        const save = createDefaultSaveData();
        const rows = getRunModeChallengeGateRows(save);

        expect(rows.map((row) => row.modeId)).toEqual(['daily', 'pass_and_play', 'puzzle_glyph_cross']);
        expect(rows.every((row) => row.offlineOnly)).toBe(true);
        expect(rows.find((row) => row.modeId === 'pass_and_play')?.status).toBe('unlocked');
        expect(rows.find((row) => row.modeId === 'puzzle_glyph_cross')?.status).toBe('in_progress');
    });
});
