import { describe, expect, it, vi } from 'vitest';
import type { SaveData, Settings } from '../shared/contracts';
import { ACHIEVEMENT_IDS, createDefaultSaveData, normalizeSaveData } from '../shared/save-data';

import type { SaveRepository } from './saveRepository';
import type { SaveRecoveryFileSystem } from './save-recovery';

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
    saveFilePath(): string {
        return '/tmp/memory-dungeon-test/memory-dungeon-save.json';
    }

    private windowState: unknown = null;

    constructor(private saveData: unknown = normalizeSaveData()) {}

    getSaveData(): unknown {
        return this.saveData;
    }

    setSaveData(saveData: SaveData): void {
        this.saveData = saveData;
    }

    getWindowState(): unknown {
        return this.windowState;
    }

    setWindowState(windowState: unknown): void {
        this.windowState = windowState;
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

    it('does not let a stale game snapshot overwrite separately persisted settings', () => {
        const p = new PersistenceService();
        const staleSave = p.getSaveData();
        p.saveSettings({
            ...staleSave.settings,
            displayMode: 'fullscreen',
            reduceMotion: true
        });

        const committed = p.saveGame({ ...staleSave, bestScore: 9001 });

        expect(committed.bestScore).toBe(9001);
        expect(committed.settings).toMatchObject({ displayMode: 'fullscreen', reduceMotion: true });
        expect(p.getSaveData()).toEqual(committed);
    });

    it('rejects invalid persistence roots without replacing stored save data', () => {
        const repository = new MemorySaveRepository({ ...createDefaultSaveData(), bestScore: 77 });
        const p = new PersistenceService(repository);

        expect(() => p.saveGame(['not', 'a', 'save'])).toThrow('recognized field');
        expect(() => p.saveGame({ undocumentedSave: true })).toThrow('recognized field');
        expect(() => p.saveSettings('not settings')).toThrow('recognized field');
        expect(() => p.saveSettings({ undocumentedSetting: true })).toThrow('recognized field');
        expect((repository.getSaveData() as SaveData).bestScore).toBe(77);
    });

    it('rejects a non-object repository payload as a read failure', () => {
        const p = new PersistenceService(new MemorySaveRepository(['corrupt']));

        expect(() => p.getSaveData()).toThrow('recognized field');
    });

    it('does not downgrade a save written by a newer app schema', () => {
        const futureSave = { ...createDefaultSaveData(), schemaVersion: createDefaultSaveData().schemaVersion + 1 };
        const repository = new MemorySaveRepository(futureSave);
        const p = new PersistenceService(repository);

        expect(() => p.getSaveData()).toThrow('newer unsupported schema version');
        expect(() => p.saveGame(futureSave)).toThrow('newer unsupported schema version');
        expect(repository.getSaveData()).toBe(futureSave);
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

    it('does not rewrite save data for an achievement already persisted locally', () => {
        const saveData = createDefaultSaveData();
        saveData.achievements.ACH_FIRST_CLEAR = true;
        const repository = new MemorySaveRepository(saveData);
        const write = vi.spyOn(repository, 'setSaveData');
        const p = new PersistenceService(repository);

        expect(p.unlockAchievement('ACH_FIRST_CLEAR')).toEqual(saveData);
        expect(write).not.toHaveBeenCalled();
    });

    it('remembers where the window was, and keeps the size when a minimized close reports none', () => {
        const repository = new MemorySaveRepository();
        const p = new PersistenceService(repository);
        expect(p.getWindowState()).toEqual({ bounds: null, maximized: false });

        p.saveWindowState({ bounds: { height: 800, width: 1200, x: 40, y: 60 }, maximized: false });
        expect(p.getWindowState()).toEqual({ bounds: { height: 800, width: 1200, x: 40, y: 60 }, maximized: false });

        p.saveWindowState({ bounds: null, maximized: true });
        expect(p.getWindowState()).toEqual({ bounds: { height: 800, width: 1200, x: 40, y: 60 }, maximized: true });
    });

    it('never refuses to quit over a window-placement write failure', () => {
        const repository = new MemorySaveRepository();
        repository.setWindowState = () => {
            throw new Error('disk full');
        };
        const p = new PersistenceService(repository);
        expect(() => p.saveWindowState({ bounds: { height: 800, width: 1200, x: 0, y: 0 }, maximized: false })).not.toThrow();
    });
});

describe('recovering an unreadable save', () => {
    it('keeps the old file, starts a fresh profile, and lets writes through again', () => {
        const repository = new MemorySaveRepository();
        const kept: string[] = [];
        const fileSystem: SaveRecoveryFileSystem = {
            basename: (path) => path.slice(path.lastIndexOf('/') + 1),
            copy: (_from, to) => kept.push(to),
            dirname: (path) => path.slice(0, path.lastIndexOf('/')),
            exists: () => true,
            join: (...segments) => segments.join('/'),
            listDirectory: () => [],
            remove: () => undefined
        };
        const persistence = new PersistenceService(repository, fileSystem);

        const result = persistence.recoverUnreadableSave('2026-09-03T20:45:12.884Z');

        expect(result.quarantinedAs).toContain('unreadable');
        expect(kept).toHaveLength(1);
        expect(result.saveData.bestScore).toBe(0);
        // The reset is what unblocks writing: the store now holds a save this build can read.
        expect(() => persistence.getSaveData()).not.toThrow();
    });

    it('still starts a fresh profile when the old file cannot be copied aside', () => {
        const reportError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const repository = new MemorySaveRepository();
        const failingFileSystem: SaveRecoveryFileSystem = {
            basename: (path) => path.slice(path.lastIndexOf('/') + 1),
            copy: () => {
                throw Object.assign(new Error('no space left on device'), { code: 'ENOSPC' });
            },
            dirname: (path) => path.slice(0, path.lastIndexOf('/')),
            exists: () => true,
            join: (...segments) => segments.join('/'),
            listDirectory: () => [],
            remove: () => undefined
        };

        const result = new PersistenceService(repository, failingFileSystem).recoverUnreadableSave();

        // Leaving the player stuck with autosave off is the worse outcome, and they can already
        // see the notice saying the read failed.
        expect(result.quarantinedAs).toBeNull();
        expect(result.saveData.bestScore).toBe(0);
        reportError.mockRestore();
    });
});
