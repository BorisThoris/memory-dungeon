import type { DungeonKeyKind } from './contracts';

export type DungeonKeyInventory = Partial<Record<DungeonKeyKind, number>>;

export const addRunDungeonKey = (
    keys: DungeonKeyInventory,
    kind: DungeonKeyKind,
    amount: number
): DungeonKeyInventory => ({
    ...keys,
    [kind]: Math.max(0, (keys[kind] ?? 0) + amount)
});
