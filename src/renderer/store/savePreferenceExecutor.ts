import type {
    MetaProgressionUnlockResult
} from '../../shared/meta-progression';
import { applyMetaProgressionUnlock } from '../../shared/meta-progression';
import type { SaveData, Settings } from '../../shared/contracts';
import { normalizeSaveData } from '../../shared/save-data';
import {
    createHowToPlayDismissPatch,
    createPowersFtueDismissPatch,
    type SavePreferencePatch
} from './savePreferenceSurfaceState';

export interface SavePreferenceExecutorState {
    saveData: SaveData;
    settings: Settings;
}

export interface SavePreferenceExecutorDeps {
    getState: () => SavePreferenceExecutorState;
    persistSaveData: (saveData: SaveData) => Promise<unknown>;
    persistSaveSettings: (settings: Settings) => Promise<Settings>;
    setState: (patch: Partial<SavePreferenceExecutorState> | SavePreferencePatch) => void;
}

export const executeSettingsUpdate = async (
    settings: Settings,
    deps: SavePreferenceExecutorDeps
): Promise<void> => {
    const persistedSettings = await deps.persistSaveSettings(settings);
    const nextSave = normalizeSaveData({
        ...deps.getState().saveData,
        settings: persistedSettings
    });

    deps.setState({
        settings: persistedSettings,
        saveData: nextSave
    });
};

export const executePowersFtueDismiss = async (deps: SavePreferenceExecutorDeps): Promise<void> => {
    const patch = createPowersFtueDismissPatch(deps.getState().saveData);
    deps.setState(patch);
    await deps.persistSaveData(patch.saveData);
};

export const executeHowToPlayDismiss = async (deps: SavePreferenceExecutorDeps): Promise<void> => {
    const patch = createHowToPlayDismissPatch(deps.getState().saveData);
    deps.setState(patch);
    await deps.persistSaveData(patch.saveData);
};

export const executeMetaProgressionRewardClaim = (
    rowId: string,
    deps: SavePreferenceExecutorDeps
): MetaProgressionUnlockResult => {
    const result = applyMetaProgressionUnlock(deps.getState().saveData, rowId);
    if (!result.applied) {
        return result;
    }

    deps.setState({
        saveData: result.save,
        settings: result.save.settings
    });
    void deps.persistSaveData(result.save);
    return result;
};
