import type { RunState } from '../../shared/contracts';
import { restoreGodRun, serializeGodRun } from '../../shared/god-run-save';

const database = (): Promise<IDBDatabase> => new Promise((resolve,reject) => {
    const request = indexedDB.open('memory-dungeon-endless',1);
    request.onupgradeneeded = () => request.result.createObjectStore('checkpoints');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
});
const access = async (write: boolean, value?: unknown): Promise<unknown> => {
    const db = await database();
    try {
        return await new Promise((resolve,reject) => {
            const transaction = db.transaction('checkpoints',write?'readwrite':'readonly');
            const store = transaction.objectStore('checkpoints');
            const request = write ? value === undefined ? store.delete('current') : store.put(value,'current') : store.get('current');
            transaction.oncomplete = () => resolve(request.result);
            transaction.onerror = () => reject(transaction.error);
            transaction.onabort = () => reject(transaction.error ?? new Error('Checkpoint aborted'));
        });
    } finally { db.close(); }
};
export const saveGodCheckpoint = async (run: RunState): Promise<void> => {
    if (!run.godRun) return;
    await access(true,{ version:1, run: { ...run, godRun:undefined }, god:serializeGodRun(run.godRun) });
};
export const clearGodCheckpoint = async (): Promise<void> => { await access(true); };
export const loadGodCheckpoint = async (): Promise<RunState | null> => {
    const value = await access(false) as {version?:number;run?:RunState;god?:unknown} | undefined;
    if (!value) return null;
    const godRun=restoreGodRun(value.god);
    if (value.version!==1 || !godRun || value.run?.runRulesVersion!==59 || value.run.runSeed!==godRun.seed || value.run.gameMode!=='endless' || !value.run.board) throw new Error('Endless checkpoint is not readable by this version.');
    return { ...value.run, status:'playing', godRun };
};
