import { describe, expect, it, vi } from 'vitest';
import type { SaveData, Settings } from '../shared/contracts';
import { ACHIEVEMENT_IDS, createDefaultSaveData, normalizeSaveData } from '../shared/save-data';

import type { SaveRepository } from './saveRepository';

vi.mock('electron-store', () => {
    return {
        default: class MockElectronStore {
            private data: Record<string, unknown>;
            constructor(opts?: { defaults?: { saveData: SaveData }; name?: string }) {
                this.data = { saveData: opts?.defaults?.saveData ?? normalizeSaveData() };
            }
            get(key: string): unknown {
                return this.data[key];
            }
            set(key: string, value: unknown): void {
                this.data[key] = value;
            }
        }
    };
});

import { PersistenceService } from './persistence';

class MemorySaveRepository implements SaveRepository {
    constructor(private saveData: unknown = normalizeSaveData()) {}

    getSaveData(): unknown {
        return this.saveData;
    }

    setSaveData(saveData: SaveData): void {
        this.saveData = saveData;
    }
}

describe('PersistenceService', () => {
    it('returns defaults aligned with normalizeSaveData / createDefaultSaveData', () => {
        const p = new PersistenceService();
        const data = p.getSaveData();
        expect(data).toEqual(normalizeSaveData());
        expect(data.settings).toEqual(createDefaultSaveData().settings);
    });

    it('saveSettings persists normalized settings', () => {
        const p = new PersistenceService();
        const base = p.getSaveData();
        const next = p.saveSettings({
            ...base.settings,
            displayMode: 'fullscreen',
            weakerShuffleMode: 'rows_only'
        });
        expect(next.settings.displayMode).toBe('fullscreen');
        const roundTrip = p.getSaveData();
        expect(roundTrip.settings.displayMode).toBe('fullscreen');
        expect(roundTrip.settings.weakerShuffleMode).toBe('rows_only');
    });

    it('persists through an injected save repository', () => {
        const repository = new MemorySaveRepository();
        const p = new PersistenceService(repository);

        p.saveSettings({
            ...createDefaultSaveData().settings,
            reduceMotion: true
        });

        expect((repository.getSaveData() as SaveData).settings.reduceMotion).toBe(true);
    });

    it('saveSettings normalizes malformed runtime settings payloads', () => {
        const p = new PersistenceService();
        const next = p.saveSettings({
            ...p.getSaveData().settings,
            displayMode: 'kiosk',
            debugFlags: 'bad'
        } as unknown as Settings);

        expect(next.settings.displayMode).toBe(createDefaultSaveData().settings.displayMode);
        expect(next.settings.debugFlags).toEqual(createDefaultSaveData().settings.debugFlags);
    });

    it('saveGame writes normalized payload', () => {
        const p = new PersistenceService();
        const corrupted = {
            ...createDefaultSaveData(),
            settings: {
                ...createDefaultSaveData().settings,
                weakerShuffleMode: 'not-a-mode' as Settings['weakerShuffleMode']
            }
        };
        p.saveGame(corrupted);
        const read = p.getSaveData();
        expect(read.settings.weakerShuffleMode).toBe(createDefaultSaveData().settings.weakerShuffleMode);
    });

    it('unlockAchievement merges into achievements without dropping others', () => {
        const p = new PersistenceService();
        p.unlockAchievement('ACH_FIRST_CLEAR');
        const data = p.getSaveData();
        expect(data.achievements.ACH_FIRST_CLEAR).toBe(true);
        ACHIEVEMENT_IDS.forEach((id) => {
            if (id !== 'ACH_FIRST_CLEAR') {
                expect(data.achievements[id]).toBe(false);
            }
        });
    });
});
