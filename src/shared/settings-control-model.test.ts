import { describe, expect, it } from 'vitest';
import {
    getReferenceOnlySettingsRows,
    referenceControlsWithPersistedSettings,
    SETTINGS_REFERENCE_CONTROL_ROWS
} from './settings-control-model';

describe('REG-036 reference settings controls model', () => {
    it('keeps reference-only controls honest and non-persisted', () => {
        const rows = getReferenceOnlySettingsRows().filter((row) => row.status === 'future_placeholder');
        // No 'max_lives' row: lives went in Gen 183 (docs/REMOVED_LIVES.md), and a reference control
        // for a rule that does not exist would be a promise the settings screen cannot keep.
        expect(rows.map((row) => row.id)).toEqual(['difficulty', 'timer_mode', 'card_theme']);
        for (const row of SETTINGS_REFERENCE_CONTROL_ROWS) {
            expect(`${row.label} ${row.copy} ${row.hint} ${row.ruleImpact}`, row.id).not.toMatch(/\blives\b|\blife\b|grace/i);
        }
        expect(rows.every((row) => row.status === 'future_placeholder')).toBe(true);
        expect(rows.every((row) => row.persistedSettingKey === null)).toBe(true);
        expect(rows.every((row) => row.migrationRequiredWhenEnabled || row.rulesVersionRequiredWhenEnabled)).toBe(true);
    });

    it('documents rule and migration implications before enabling any row', () => {
        const difficulty = SETTINGS_REFERENCE_CONTROL_ROWS.find((row) => row.id === 'difficulty');
        const cardTheme = SETTINGS_REFERENCE_CONTROL_ROWS.find((row) => row.id === 'card_theme');
        expect(difficulty?.ruleImpact).toMatch(/GAME_RULES_VERSION/);
        expect(difficulty?.achievementImplication).toMatch(/daily/i);
        expect(cardTheme?.saveMigrationImplication).toMatch(/SaveData/);
        expect(referenceControlsWithPersistedSettings()).toEqual([]);
    });
});
