import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from './save-data';
import { FEATURE_CLOUD_SAVE } from './feature-flags';
import { buildProfileSaveShellSummary, getProfileSummaryRows, getSaveTrustRows } from './profile-summary';

describe('REG-032 profile summary and save trust shell', () => {
    it('derives profile summary rows from real local save state', () => {
        const save = createDefaultSaveData();
        save.bestScore = 2400;
        save.playerStats = {
            ...save.playerStats!,
            dailiesCompleted: 3,
            bestFloorNoPowers: 5
        };
        save.unlocks = ['cosmetic:crest_daily_bronze'];

        const rows = getProfileSummaryRows(save);
        expect(rows.map((row) => row.id)).toContain('profile_level');
        expect(rows.find((row) => row.id === 'best_score')?.value).toBe('2,400');
        expect(rows.find((row) => row.id === 'cosmetics')?.value).toBe('1');
        expect(rows.every((row) => row.source.length > 0)).toBe(true);
    });

    it('explains save scope, cloud deferral, export/import, backup, and reset behavior', () => {
        const rows = getSaveTrustRows(createDefaultSaveData());
        expect(rows.map((row) => row.id)).toEqual(['slot_scope', 'cloud_sync', 'export_import', 'backup', 'reset']);
        expect(rows.find((row) => row.id === 'cloud_sync')?.status).toBe('deferred');
        expect(rows.find((row) => row.id === 'reset')?.description).toMatch(/confirmation/i);
    });

    it('uses the product cloud-save feature gate for default save-trust copy', () => {
        const summary = buildProfileSaveShellSummary(createDefaultSaveData());

        expect(FEATURE_CLOUD_SAVE).toBe(false);
        expect(summary.cloudSyncState).toBe('not_available');
        expect(summary.cloudSyncCopy).toMatch(/not available in this build/i);
    });

    it('keeps the explicit cloud availability override for platform-specific shells', () => {
        const rows = getSaveTrustRows(createDefaultSaveData(), { cloudSaveAvailable: true });

        expect(rows.find((row) => row.id === 'cloud_sync')).toEqual({
            id: 'cloud_sync',
            label: 'Cloud sync',
            status: 'active',
            description: 'Platform cloud sync is available for this profile.'
        });
    });
});
