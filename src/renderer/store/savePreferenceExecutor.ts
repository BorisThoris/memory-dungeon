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

export interface SavePreferenceExecutorDeps<State extends SavePreferenceExecutorState> {
    getState: () => State;
    persistSaveData: (saveData: SaveData) => Promise<unknown>;
    persistSaveSettings: (settings: Settings) => Promise<Settings>;
    setState: (patch: Partial<State> | SavePreferencePatch) => void;
}

export const executeSettingsUpdate = async <State extends SavePreferenceExecutorState>(
    settings: Settings,
    deps: SavePreferenceExecutorDeps<State>
): Promise<void> => {
    const persistedSettings = await deps.persistSaveSettings(settings);
    const nextSave = normalizeSaveData({
        ...deps.getState().saveData,
        settings: persistedSettings
    });

    deps.setState({
        settings: persistedSettings,
        saveData: nextSave
    } as Partial<State>);
};

export const executePowersFtueDismiss = async <State extends SavePreferenceExecutorState>(
    deps: SavePreferenceExecutorDeps<State>
): Promise<void> => {
    const patch = createPowersFtueDismissPatch(deps.getState().saveData);
    deps.setState(patch);
    await deps.persistSaveData(patch.saveData);
};

export const executeHowToPlayDismiss = async <State extends SavePreferenceExecutorState>(
    deps: SavePreferenceExecutorDeps<State>
): Promise<void> => {
    const patch = createHowToPlayDismissPatch(deps.getState().saveData);
    deps.setState(patch);
    await deps.persistSaveData(patch.saveData);
};

export const executeMetaProgressionRewardClaim = <State extends SavePreferenceExecutorState>(
    rowId: string,
    deps: SavePreferenceExecutorDeps<State>
): MetaProgressionUnlockResult => {
    const result = applyMetaProgressionUnlock(deps.getState().saveData, rowId);
    if (!result.applied) {
        return result;
    }

    deps.setState({
        saveData: result.save,
        settings: result.save.settings
    } as Partial<State>);
    void deps.persistSaveData(result.save);
    return result;
};
