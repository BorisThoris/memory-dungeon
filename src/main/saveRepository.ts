import Store from 'electron-store';
import type { SaveData } from '../shared/contracts';
import { SAVE_STORE_NAME } from '../shared/save-location';
import { normalizeWindowState, type WindowState } from './window-bounds';

interface StoreShape {
    saveData?: SaveData;
    windowState: WindowState;
}

export interface SaveRepository {
    getSaveData: () => unknown;
    setSaveData: (saveData: SaveData) => void;
    /** Where the store keeps its file, so an unreadable save can be copied aside before reset. */
    saveFilePath: () => string;
    /** Window placement is a property of this machine, not of the save, so it never travels. */
    getWindowState: () => unknown;
    setWindowState: (windowState: WindowState) => void;
}

export class ElectronStoreSaveRepository implements SaveRepository {
    private readonly store = new Store<StoreShape>({
        // Shared with the Steam Auto-Cloud configuration, so the two cannot drift apart.
        name: SAVE_STORE_NAME,
        /*
         * No default save (2026-11-14): electron-store writes its defaults into the file, so a
         * default save here made every first launch look like a returning player on Medium, and the
         * first-launch graphics tier (`graphicsTier.ts`) never ran on the desktop build.
         */
        defaults: {
            windowState: normalizeWindowState(null)
        }
    });

    /** The stored save, or undefined when this machine has never saved one (a first launch). */
    getSaveData(): unknown {
        return this.store.get('saveData');
    }

    setSaveData(saveData: SaveData): void {
        this.store.set('saveData', saveData);
    }

    saveFilePath(): string {
        return this.store.path;
    }

    getWindowState(): unknown {
        return this.store.get('windowState');
    }

    setWindowState(windowState: WindowState): void {
        this.store.set('windowState', windowState);
    }
}
