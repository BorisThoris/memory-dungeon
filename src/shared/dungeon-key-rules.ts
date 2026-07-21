import type { BoardState, DungeonKeyKind } from './contracts';

export type DungeonKeyInventory = Partial<Record<DungeonKeyKind, number>>;

const nonNegativeDungeonKeyCount = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;

const finiteDungeonKeyDelta = (value: unknown): number =>
    typeof value === 'number' && Number.isFinite(value) ? Math.trunc(value) : 0;

export const addRunDungeonKey = (
    keys: DungeonKeyInventory,
    kind: DungeonKeyKind,
    amount: number
): DungeonKeyInventory => ({
    ...keys,
    [kind]: Math.max(0, nonNegativeDungeonKeyCount(keys[kind] ?? 0) + finiteDungeonKeyDelta(amount))
});

export const getFloorHeldDungeonKeyCount = (
    board: Pick<BoardState, 'dungeonKeysHeld' | 'dungeonKeysHeldByKind'> | null | undefined,
    kind: DungeonKeyKind
): number =>
    nonNegativeDungeonKeyCount(board?.dungeonKeysHeldByKind?.[kind]) +
    (board?.dungeonKeysHeldByKind == null && kind === 'iron'
        ? nonNegativeDungeonKeyCount(board?.dungeonKeysHeld)
        : 0);
