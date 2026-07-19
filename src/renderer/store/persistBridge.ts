import type { SaveData, Settings } from '../../shared/contracts';
import { normalizeUnknownSaveDataOrThrow, normalizeUnknownSettingsOrThrow } from '../../shared/save-data';
import { desktopClient } from '../desktop-client';

let consecutiveWriteFailures = 0;

type PersistenceWriteOperation = 'game' | 'settings';
type SaveHealthStatus = 'ok' | 'transient_write_failed' | 'repeated_write_failed';

interface SaveHealthSnapshot {
    status: SaveHealthStatus;
    consecutiveFailures: number;
    operation: PersistenceWriteOperation | null;
    recoveryActions: string[];
}

type WriteFailDetail = { consecutive: number; op: PersistenceWriteOperation };

let onWriteFail: ((detail: WriteFailDetail) => void) | null = null;
let lastFailedOperation: PersistenceWriteOperation | null = null;

/** Wired once from `useAppStore` so we can surface disk errors without circular imports. */
export const registerPersistenceWriteFailureHandler = (fn: ((detail: WriteFailDetail) => void) | null): void => {
    onWriteFail = fn;
};

const SHORT_NOTICE =
    'Save write failed. Current progress remains in memory, but may not persist after closing until the next successful save.';
const REPEATED_NOTICE =
    'Save keeps failing. Keep the app open; progress and setting changes may not persist after closing. Check disk space or file permissions, close programs locking the save, then trigger another save.';

const resetSaveHealth = (): void => {
    consecutiveWriteFailures = 0;
    lastFailedOperation = null;
};

export const createSaveHealthSnapshot = (detail: { consecutive: number; op: PersistenceWriteOperation | null }): SaveHealthSnapshot => ({
    status:
        detail.consecutive === 0
            ? 'ok'
            : detail.consecutive >= 2
              ? 'repeated_write_failed'
              : 'transient_write_failed',
    consecutiveFailures: detail.consecutive,
    operation: detail.op,
    recoveryActions:
        detail.consecutive >= 2
            ? ['keep_session_open', 'retry_next_save', 'check_disk_space', 'check_file_permissions', 'close_locking_programs']
            : detail.consecutive === 1
              ? ['keep_session_open', 'retry_next_save', 'check_disk_space']
              : []
});

export const getSaveHealthSnapshot = (): SaveHealthSnapshot =>
    createSaveHealthSnapshot({ consecutive: consecutiveWriteFailures, op: lastFailedOperation });

export const saveHealthCopyForSnapshot = (snapshot: SaveHealthSnapshot): string =>
    snapshot.status === 'repeated_write_failed'
        ? REPEATED_NOTICE
        : snapshot.status === 'transient_write_failed'
          ? SHORT_NOTICE
          : 'Save system healthy.';

export const persistSaveData = async (saveData: SaveData): Promise<SaveData> => {
    try {
        const out = normalizeUnknownSaveDataOrThrow(await desktopClient.saveGame(saveData));
        resetSaveHealth();
        return out;
    } catch (error) {
        consecutiveWriteFailures += 1;
        lastFailedOperation = 'game';
        console.error('[persist] saveGame failed', error);
        onWriteFail?.({
            consecutive: consecutiveWriteFailures,
            op: 'game'
        });
        throw error;
    }
};

export const persistSaveSettings = async (settings: Settings): Promise<Settings> => {
    try {
        const out = normalizeUnknownSettingsOrThrow(await desktopClient.saveSettings(settings));
        resetSaveHealth();
        return out;
    } catch (error) {
        consecutiveWriteFailures += 1;
        lastFailedOperation = 'settings';
        console.error('[persist] saveSettings failed', error);
        onWriteFail?.({
            consecutive: consecutiveWriteFailures,
            op: 'settings'
        });
        throw error;
    }
};

export const persistenceNoticeForConsecutiveFailures = (consecutive: number): string =>
    saveHealthCopyForSnapshot(createSaveHealthSnapshot({ consecutive, op: lastFailedOperation }));
