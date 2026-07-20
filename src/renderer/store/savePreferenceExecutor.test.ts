import { describe, expect, it, vi } from 'vitest';
import type { SaveData, Settings } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import {
    executeHowToPlayDismiss,
    executeMetaProgressionRewardClaim,
    executePowersFtueDismiss,
    executeSettingsUpdate,
    type SavePreferenceExecutorDeps
} from './savePreferenceExecutor';

const createDeps = (
    saveData: SaveData = createDefaultSaveData()
): SavePreferenceExecutorDeps => ({
    getState: vi.fn(() => ({ saveData, settings: saveData.settings })),
    persistSaveData: vi.fn(async () => undefined),
    persistSaveSettings: vi.fn(async (settings: Settings) => settings),
    setState: vi.fn()
});

describe('save preference executor', () => {
    it('persists settings and mirrors them into normalized save data', async () => {
        const saveData = createDefaultSaveData();
        const nextSettings = {
            ...saveData.settings,
            reduceMotion: !saveData.settings.reduceMotion
        };
        const deps = createDeps(saveData);

        await executeSettingsUpdate(nextSettings, deps);

        expect(deps.persistSaveSettings).toHaveBeenCalledWith(nextSettings);
        expect(deps.setState).toHaveBeenCalledWith({
            saveData: expect.objectContaining({ settings: nextSettings }),
            settings: nextSettings
        });
    });

    it('keeps a settings update in memory when persistence rejects', async () => {
        const saveData = createDefaultSaveData();
        const state = { saveData, settings: saveData.settings };
        const order: string[] = [];
        const nextSettings = {
            ...saveData.settings,
            reduceMotion: true
        };
        const deps: SavePreferenceExecutorDeps = {
            getState: () => state,
            persistSaveData: vi.fn(async () => undefined),
            persistSaveSettings: vi.fn(async (settings) => {
                order.push('persist');
                expect(state.settings).toBe(settings);
                throw new Error('disk unavailable');
            }),
            setState: vi.fn((patch) => {
                order.push('state');
                Object.assign(state, patch);
            })
        };

        await expect(executeSettingsUpdate(nextSettings, deps)).rejects.toThrow('disk unavailable');

        expect(order).toEqual(['state', 'persist']);
        expect(state.settings.reduceMotion).toBe(true);
        expect(state.saveData.settings.reduceMotion).toBe(true);
    });

    it('applies a changed host acknowledgement while the optimistic update still owns state', async () => {
        const saveData = createDefaultSaveData();
        const state = { saveData, settings: saveData.settings };
        const deps: SavePreferenceExecutorDeps = {
            getState: () => state,
            persistSaveData: vi.fn(async () => undefined),
            persistSaveSettings: vi.fn(async (settings) => ({
                ...settings,
                graphicsQuality: 'low'
            })),
            setState: vi.fn((patch) => {
                Object.assign(state, patch);
            })
        };

        await executeSettingsUpdate({ ...saveData.settings, graphicsQuality: 'high' }, deps);

        expect(state.settings.graphicsQuality).toBe('low');
        expect(state.saveData.settings.graphicsQuality).toBe('low');
    });

    it('does not let an older settings acknowledgement overwrite a newer update', async () => {
        const saveData = createDefaultSaveData();
        const state = { saveData, settings: saveData.settings };
        const writes: Array<{
            resolve: (settings: Settings) => void;
            settings: Settings;
        }> = [];
        const deps: SavePreferenceExecutorDeps = {
            getState: () => state,
            persistSaveData: vi.fn(async () => undefined),
            persistSaveSettings: vi.fn(
                (settings) =>
                    new Promise<Settings>((resolve) => {
                        writes.push({ resolve, settings });
                    })
            ),
            setState: vi.fn((patch) => {
                Object.assign(state, patch);
            })
        };
        const firstSettings = { ...saveData.settings, reduceMotion: true };
        const latestSettings = { ...saveData.settings, graphicsQuality: 'high' as const };

        const firstUpdate = executeSettingsUpdate(firstSettings, deps);
        const latestUpdate = executeSettingsUpdate(latestSettings, deps);
        writes[1]!.resolve(writes[1]!.settings);
        await latestUpdate;
        writes[0]!.resolve(writes[0]!.settings);
        await firstUpdate;

        expect(state.settings).toMatchObject({ graphicsQuality: 'high', reduceMotion: false });
        expect(state.saveData.settings).toMatchObject({ graphicsQuality: 'high', reduceMotion: false });
    });

    it('dismisses powers FTUE locally before persisting the save', async () => {
        const deps = createDeps();

        await executePowersFtueDismiss(deps);

        expect(deps.setState).toHaveBeenCalledWith(expect.objectContaining({
            saveData: expect.objectContaining({ powersFtueSeen: true })
        }));
        expect(deps.persistSaveData).toHaveBeenCalledWith(expect.objectContaining({ powersFtueSeen: true }));
    });

    it('dismisses how-to-play without dismissing onboarding', async () => {
        const deps = createDeps();

        await executeHowToPlayDismiss(deps);

        expect(deps.setState).toHaveBeenCalledWith(expect.objectContaining({
            saveData: expect.objectContaining({
                firstRunHelpDismissed: true,
                onboardingDismissed: false
            })
        }));
        expect(deps.persistSaveData).toHaveBeenCalledWith(expect.objectContaining({ firstRunHelpDismissed: true }));
    });

    it('claims applied meta rewards and persists the updated save in the background', () => {
        const saveData = createDefaultSaveData();
        saveData.playerStats = {
            ...saveData.playerStats!,
            dailiesCompleted: 7,
            relicShrineExtraPickUnlocked: false
        };
        const deps = createDeps(saveData);

        const result = executeMetaProgressionRewardClaim('upgrade_relic_shrine_extra_pick', deps);

        expect(result.applied).toBe(true);
        expect(deps.setState).toHaveBeenCalledWith({
            saveData: expect.objectContaining({
                playerStats: expect.objectContaining({ relicShrineExtraPickUnlocked: true })
            }),
            settings: result.save.settings
        });
        expect(deps.persistSaveData).toHaveBeenCalledWith(result.save);
    });

    it('returns locked meta reward results without mutating state', () => {
        const deps = createDeps();

        const result = executeMetaProgressionRewardClaim('upgrade_relic_shrine_extra_pick', deps);

        expect(result.applied).toBe(false);
        expect(deps.setState).not.toHaveBeenCalled();
        expect(deps.persistSaveData).not.toHaveBeenCalled();
    });
});
