import Store from 'electron-store';
import type { SaveData } from '../shared/contracts';
import { normalizeSaveData } from '../shared/save-data';

interface StoreShape {
    saveData: SaveData;
}

export interface SaveRepository {
    getSaveData: () => unknown;
    setSaveData: (saveData: SaveData) => void;
}

export class ElectronStoreSaveRepository implements SaveRepository {
    private readonly store = new Store<StoreShape>({
        name: 'memory-dungeon-save',
        defaults: {
            saveData: normalizeSaveData()
        }
    });

    getSaveData(): unknown {
        return this.store.get('saveData');
    }

    setSaveData(saveData: SaveData): void {
        this.store.set('saveData', saveData);
    }
}

