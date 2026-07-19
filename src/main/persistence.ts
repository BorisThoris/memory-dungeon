import type { AchievementId, SaveData, Settings } from '../shared/contracts';
import {
    normalizeSaveData,
    normalizeUnknownSaveDataOrThrow,
    normalizeUnknownSettingsOrThrow
} from '../shared/save-data';
import { ElectronStoreSaveRepository, type SaveRepository } from './saveRepository';

type PersistenceWriteErrorCode = 'quota' | 'permission' | 'busy' | 'unknown';

/** Thrown when `electron-store` cannot persist (disk, permissions, locks). No PII in message. */
export class PersistenceWriteError extends Error {
    readonly code: PersistenceWriteErrorCode;

    constructor(code: PersistenceWriteErrorCode, cause?: unknown) {
        super(`Save write failed (${code})`, cause !== undefined ? { cause } : undefined);
        this.name = 'PersistenceWriteError';
        this.code = code;
    }
}

const mapNodeErrorToCode = (err: unknown): PersistenceWriteErrorCode => {
    const e = err as NodeJS.ErrnoException & { code?: string };
    const code = e?.code;
    if (code === 'ENOSPC') {
        return 'quota';
    }
    if (code === 'EACCES' || code === 'EPERM') {
        return 'permission';
    }
    if (code === 'EBUSY' || code === 'ELOCKED' || code === 'ETXTBSY') {
        return 'busy';
    }
    return 'unknown';
};

export class PersistenceService {
    constructor(private readonly repository: SaveRepository = new ElectronStoreSaveRepository()) {}

    private commitSaveData(nextSave: SaveData): void {
        try {
            this.repository.setSaveData(nextSave);
        } catch (error) {
            const code = mapNodeErrorToCode(error);
            console.error('[persistence] store.set failed', code, error);
            throw new PersistenceWriteError(code, error);
        }
    }

    getSaveData(): SaveData {
        return normalizeUnknownSaveDataOrThrow(this.repository.getSaveData());
    }

    getSettings(): Settings {
        return this.getSaveData().settings;
    }

    saveSettings(settings: unknown): SaveData {
        const normalizedSettings = normalizeUnknownSettingsOrThrow(settings);
        const nextSave = normalizeSaveData({
            ...this.getSaveData(),
            settings: normalizedSettings
        });

        this.commitSaveData(nextSave);
        return nextSave;
    }

    saveGame(saveData: unknown): SaveData {
        const nextSave = normalizeUnknownSaveDataOrThrow(saveData);
        this.commitSaveData(nextSave);
        return nextSave;
    }

    unlockAchievement(achievementId: AchievementId): SaveData {
        const saveData = this.getSaveData();
        if (saveData.achievements[achievementId]) {
            return saveData;
        }
        const nextSave = normalizeSaveData({
            ...saveData,
            achievements: {
                ...saveData.achievements,
                [achievementId]: true
            }
        });

        this.commitSaveData(nextSave);
        return nextSave;
    }
}
