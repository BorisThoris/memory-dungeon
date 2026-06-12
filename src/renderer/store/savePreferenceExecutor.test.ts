import { describe, expect, it, vi } from 'vitest';
import type { SaveData, Settings } from '../../shared/contracts';
import { createDefaultSaveData } from '../../shared/save-data';
import {
    executeHowToPlayDismiss,
    executeMetaProgressionRewardClaim,
    executePowersFtueDismiss,
    executeSettingsUpdate,
    type SavePreferenceExecutorDeps,
    type SavePreferenceExecutorState
} from './savePreferenceExecutor';

const createDeps = (
    saveData: SaveData = createDefaultSaveData()
): SavePreferenceExecutorDeps<SavePreferenceExecutorState> => ({
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
