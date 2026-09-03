import Store from 'electron-store';
import type { SaveData } from '../shared/contracts';
import { normalizeSaveData } from '../shared/save-data';
import { SAVE_STORE_NAME } from '../shared/save-location';
import { normalizeWindowState, type WindowState } from './window-bounds';

interface StoreShape {
    saveData: SaveData;
    windowState: WindowState;
}

export interface SaveRepository {
    getSaveData: () => unknown;
    setSaveData: (saveData: SaveData) => void;
    /** Window placement is a property of this machine, not of the save, so it never travels. */
    getWindowState: () => unknown;
    setWindowState: (windowState: WindowState) => void;
}

export class ElectronStoreSaveRepository implements SaveRepository {
    private readonly store = new Store<StoreShape>({
        // Shared with the Steam Auto-Cloud configuration, so the two cannot drift apart.
        name: SAVE_STORE_NAME,
        defaults: {
            saveData: normalizeSaveData(),
            windowState: normalizeWindowState(null)
        }
    });

    getSaveData(): unknown {
        return this.store.get('saveData');
    }

    setSaveData(saveData: SaveData): void {
        this.store.set('saveData', saveData);
    }

    getWindowState(): unknown {
        return this.store.get('windowState');
    }

    setWindowState(windowState: WindowState): void {
        this.store.set('windowState', windowState);
    }
}
