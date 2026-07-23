import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from './save-data';
import {
    getLiveSettingsControlCount,
    getSettingsControlCenterRows,
    LIVE_SETTINGS_CONTROL_KEYS
} from './settings-control-center';

describe('REG-092 settings control center rows', () => {
    it('maps categories to real settings/save data fields and quality status', () => {
        const rows = getSettingsControlCenterRows();
        expect(rows.map((row) => row.id)).toEqual(['live_controls', 'reference_placeholders', 'profile_trust', 'mobile_reachability']);
        expect(rows.find((row) => row.id === 'live_controls')?.value).toMatch(/saved preferences/);
        expect(rows.find((row) => row.id === 'reference_placeholders')?.detail).toMatch(/disabled/);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.every((row) => row.detail.length > 0)).toBe(true);
    });

    it('keeps the live settings count aligned with persisted settings fields', () => {
        expect([...LIVE_SETTINGS_CONTROL_KEYS].sort()).toEqual(
            Object.keys(DEFAULT_SETTINGS)
                .filter((key) => key !== 'debugFlags')
                .sort()
        );
        expect(getLiveSettingsControlCount(DEFAULT_SETTINGS)).toBe(LIVE_SETTINGS_CONTROL_KEYS.length);
    });
});
