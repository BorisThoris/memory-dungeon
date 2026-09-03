import { describe, expect, it, vi } from 'vitest';
import { createDefaultSaveData, normalizeSaveData } from '../shared/save-data';
import type { SaveRepository } from './saveRepository';

class ThrowingSaveRepository implements SaveRepository {
    constructor(private readonly code: string) {}

    getSaveData(): unknown {
        return normalizeSaveData();
    }

    setSaveData(): void {
        throw this.writeFailure();
    }

    getWindowState(): unknown {
        return null;
    }

    setWindowState(): void {
        throw this.writeFailure();
    }

    private writeFailure(): NodeJS.ErrnoException {
        const err = new Error('write failed') as NodeJS.ErrnoException;
        err.code = this.code;
        return err;
    }
}

describe('PersistenceService write failures', () => {
    it('throws PersistenceWriteError with permission when injected repository throws EACCES', async () => {
        vi.resetModules();
        vi.doMock('electron-store', () => ({
            default: class MockElectronStore {
                constructor(opts?: { defaults?: { saveData: ReturnType<typeof normalizeSaveData> } }) {
                    void opts;
                }
            }
        }));

        const { PersistenceService, PersistenceWriteError } = await import('./persistence');
        const p = new PersistenceService(new ThrowingSaveRepository('EACCES'));

        let thrown: unknown;
        try {
            p.saveGame(createDefaultSaveData());
        } catch (e) {
            thrown = e;
        }

        expect(thrown).toBeInstanceOf(PersistenceWriteError);
        expect((thrown as InstanceType<typeof PersistenceWriteError>).code).toBe('permission');
    });

    it('throws PersistenceWriteError with quota when store.set throws ENOSPC', async () => {
        vi.resetModules();
        vi.doMock('electron-store', () => ({
            default: class ThrowStore {
                constructor(opts?: { defaults?: { saveData: ReturnType<typeof normalizeSaveData> } }) {
                    void opts;
                }

                get(): ReturnType<typeof normalizeSaveData> {
                    return normalizeSaveData();
                }

                set(): void {
                    const err = new Error('nospace') as NodeJS.ErrnoException;
                    err.code = 'ENOSPC';
                    throw err;
                }
            }
        }));

        const { PersistenceService, PersistenceWriteError } = await import('./persistence');
        const p = new PersistenceService();

        let thrown: unknown;
        try {
            p.saveGame(createDefaultSaveData());
        } catch (e) {
            thrown = e;
        }
        expect(thrown).toBeInstanceOf(PersistenceWriteError);
        expect((thrown as InstanceType<typeof PersistenceWriteError>).code).toBe('quota');
    });
});
