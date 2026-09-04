import { describe, expect, it } from 'vitest';
import { createDefaultSaveData } from '../../shared/save-data';
import { createHydratedAppStatePatch } from './hydrationController';

const baseDesktop = {
    getSaveData: async () => createDefaultSaveData(),
    isSteamConnected: async () => false
};

describe('crash reports at hydration', () => {
    it('carries a folder a player can go and look in', async () => {
        const patch = await createHydratedAppStatePatch({
            desktop: {
                ...baseDesktop,
                getCrashReportSummary: async () => ({
                    count: 2,
                    directory: '/home/p/.config/Memory Dungeon/crash-logs',
                    latestFileName: 'crash-2026-09-03.log'
                })
            },
            persistSaveData: async (saveData) => saveData
        });

        expect(patch.priorCrashNotice).toContain('2 crash reports');
        expect(patch.priorCrashNotice).toContain('crash-logs');
    });

    it('says nothing when nothing has crashed', async () => {
        const patch = await createHydratedAppStatePatch({
            desktop: {
                ...baseDesktop,
                getCrashReportSummary: async () => ({ count: 0, directory: '/logs', latestFileName: null })
            },
            persistSaveData: async (saveData) => saveData
        });

        expect(patch.priorCrashNotice).toBeNull();
    });

    it('boots normally when the diagnostics call fails or is missing', async () => {
        // A bridge without the method at all is the browser build; one that rejects is a bad IPC
        // round trip. Neither is worth failing a boot over.
        for (const desktop of [
            baseDesktop,
            {
                ...baseDesktop,
                getCrashReportSummary: async () => {
                    throw new Error('no bridge');
                }
            }
        ]) {
            const patch = await createHydratedAppStatePatch({
                desktop,
                persistSaveData: async (saveData) => saveData
            });

            expect(patch.priorCrashNotice).toBeNull();
            expect(patch.hydrated).toBe(true);
            expect(patch.view).toBe('menu');
        }
    });
});
