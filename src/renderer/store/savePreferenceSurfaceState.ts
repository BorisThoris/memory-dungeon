import type { SaveData, Settings } from '../../shared/contracts';
import { normalizeSaveData } from '../../shared/save-data';

export interface SavePreferencePatch {
    saveData: SaveData;
    settings: Settings;
}

export const createPowersFtueDismissPatch = (saveData: SaveData): SavePreferencePatch => {
    const nextSave = normalizeSaveData({
        ...saveData,
        powersFtueSeen: true
    });

    return {
        saveData: nextSave,
        settings: nextSave.settings
    };
};

export const createHowToPlayDismissPatch = (saveData: SaveData): SavePreferencePatch => {
    const nextSave = normalizeSaveData({
        ...saveData,
        firstRunHelpDismissed: true
    });

    return {
        saveData: nextSave,
        settings: nextSave.settings
    };
};
