import type { RunState, SaveData } from '../../shared/contracts';

/**
 * A run put down and picked up again (2026-11-13).
 *
 * Every market-leading roguelike lets a player close the game mid-run and carry on later (Slay the
 * Spire's save-and-quit, Balatro, Hades); closing Memory Dungeon lost the run. The store writes a
 * frozen snapshot of the live run here at its safe moments - a pause, a floor cleared, a new floor,
 * the app hidden or closed - and the main menu offers it back as Continue. A run comes back paused,
 * so the existing resume path restarts its clocks with the time they had left.
 *
 * It lives in `localStorage` beside the save rather than inside `SaveData`, so the save's schema,
 * its migrations and Steam's copy of it are untouched; Electron's default session keeps it across
 * launches. A snapshot is at most a few hundred kilobytes (a floor-60 board measured 440 KB).
 */
export const SUSPENDED_RUN_STORAGE_KEY = 'memory-dungeon.suspended-run';

/** Bumped when a snapshot written by an older build can no longer be read back safely. */
export const SUSPENDED_RUN_FORMAT = 1;

export interface SuspendedRun {
    format: number;
    savedAt: number;
    run: RunState;
    /** The save as the run started, which the run's end compares against (new records, unlocks). */
    runStartSaveData: SaveData | null;
}

/** What the menu says about a run waiting to be continued. */
export interface SuspendedRunSummary {
    floor: number;
    score: number;
    savedAt: number;
    passAndPlay: boolean;
}

const storage = (): Storage | null => {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null;
    }
};

/** A run worth putting down: one that is still being played. */
export const isSuspendableRun = (run: RunState | null): run is RunState =>
    run != null && run.status !== 'gameOver' && run.board != null;

export const writeSuspendedRun = (run: RunState, runStartSaveData: SaveData | null, now = Date.now()): boolean => {
    const store = storage();
    if (!store || !isSuspendableRun(run)) return false;
    const record: SuspendedRun = { format: SUSPENDED_RUN_FORMAT, savedAt: now, run, runStartSaveData };
    try {
        store.setItem(SUSPENDED_RUN_STORAGE_KEY, JSON.stringify(record));
        return true;
    } catch (error) {
        // A board too large for the browser's storage (deep Endless): the run plays on, unsaved.
        console.warn('[suspended-run] could not save the run in progress', error);
        return false;
    }
};

export const clearSuspendedRun = (): void => {
    try {
        storage()?.removeItem(SUSPENDED_RUN_STORAGE_KEY);
    } catch {
        // Nothing stored, or storage gone: there is nothing to continue either way.
    }
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

/** The stored run, or null when there is none or it cannot be trusted (it is then dropped). */
export const readSuspendedRun = (): SuspendedRun | null => {
    const store = storage();
    if (!store) return null;
    let raw: string | null;
    try {
        raw = store.getItem(SUSPENDED_RUN_STORAGE_KEY);
    } catch {
        return null;
    }
    if (!raw) return null;
    try {
        const parsed: unknown = JSON.parse(raw);
        if (
            isRecord(parsed) &&
            parsed.format === SUSPENDED_RUN_FORMAT &&
            typeof parsed.savedAt === 'number' &&
            isRecord(parsed.run) &&
            isRecord(parsed.run.board) &&
            Array.isArray(parsed.run.board.tiles) &&
            isRecord(parsed.run.timerState) &&
            typeof parsed.run.status === 'string' &&
            parsed.run.status !== 'gameOver'
        ) {
            return parsed as unknown as SuspendedRun;
        }
    } catch {
        // Fall through: a torn or foreign write is dropped below.
    }
    clearSuspendedRun();
    return null;
};

export const summarizeSuspendedRun = (suspended: SuspendedRun | null): SuspendedRunSummary | null =>
    suspended
        ? {
              floor: suspended.run.board?.level ?? 1,
              score: suspended.run.stats.totalScore,
              savedAt: suspended.savedAt,
              passAndPlay: suspended.run.passAndPlay != null
          }
        : null;
