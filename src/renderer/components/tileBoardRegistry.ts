import { useState, type MutableRefObject } from 'react';

export interface TileBoardItemRegistry<TItem> {
    register(id: string, item: TItem): void;
    unregister(id: string): void;
}

export interface TileBoardItemRegistryOptions<TItem> {
    onRegister?: (id: string, item: TItem) => void;
    onUnregister?: (id: string) => void;
}

export interface TileBoardItemRegistryStorage<TItem> {
    delete(id: string): void;
    set(id: string, item: TItem): void;
}

export interface TileBoardRefItemRegistryOptions {
    clearOnRegister?: MutableRefObject<Map<string, unknown>>;
    clearOnUnregister?: MutableRefObject<Map<string, unknown>>;
}

export const createTileBoardItemRegistry = <TItem>(
    storage: TileBoardItemRegistryStorage<TItem>,
    options: TileBoardItemRegistryOptions<TItem> = {}
): TileBoardItemRegistry<TItem> => ({
    register(id, item): void {
        storage.set(id, item);
        options.onRegister?.(id, item);
    },
    unregister(id): void {
        storage.delete(id);
        options.onUnregister?.(id);
    }
});

export const useTileBoardItemRegistry = <TItem>(
    itemsRef: MutableRefObject<Map<string, TItem>>,
    options: TileBoardRefItemRegistryOptions = {}
): TileBoardItemRegistry<TItem> => {
    const { clearOnRegister, clearOnUnregister } = options;
    const [registry] = useState<TileBoardItemRegistry<TItem>>(
        () => ({
            register(id: string, item: TItem): void {
                itemsRef.current.set(id, item);
                clearOnRegister?.current.delete(id);
            },
            unregister(id: string): void {
                itemsRef.current.delete(id);
                clearOnUnregister?.current.delete(id);
            }
        })
    );

    return registry;
};
