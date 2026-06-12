import Store from 'electron-store';
import type { AchievementId, SaveData, Settings } from '../shared/contracts';
import { normalizeSaveData, normalizeUnknownSaveData, normalizeUnknownSettings } from '../shared/save-data';

interface StoreShape {
    saveData: SaveData;
}

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
    private readonly store = new Store<StoreShape>({
        name: 'memory-dungeon-save',
        defaults: {
            saveData: normalizeSaveData()
        }
    });

    private commitSaveData(nextSave: SaveData): void {
        try {
            this.store.set('saveData', nextSave);
        } catch (error) {
            const code = mapNodeErrorToCode(error);
            console.error('[persistence] store.set failed', code, error);
            throw new PersistenceWriteError(code, error);
        }
    }

    getSaveData(): SaveData {
        return normalizeUnknownSaveData(this.store.get('saveData'));
    }

    getSettings(): Settings {
        return this.getSaveData().settings;
    }

    saveSettings(settings: unknown): SaveData {
        const normalizedSettings = normalizeUnknownSettings(settings);
        const nextSave = normalizeSaveData({
            ...this.getSaveData(),
            settings: normalizedSettings
        });

        this.commitSaveData(nextSave);
        return nextSave;
    }

    saveGame(saveData: unknown): SaveData {
        const nextSave = normalizeUnknownSaveData(saveData);
        this.commitSaveData(nextSave);
        return nextSave;
    }

    unlockAchievement(achievementId: AchievementId): SaveData {
        const saveData = this.getSaveData();
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
