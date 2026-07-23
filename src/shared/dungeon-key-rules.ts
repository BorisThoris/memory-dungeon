import type { BoardState, DungeonKeyKind } from './contracts';
import { runFiniteIntegerDelta, runNonNegativeInteger } from './run-number-guards';

export type DungeonKeyInventory = Partial<Record<DungeonKeyKind, number>>;

export const addRunDungeonKey = (
    keys: DungeonKeyInventory,
    kind: DungeonKeyKind,
    amount: number
): DungeonKeyInventory => ({
    ...keys,
    [kind]: Math.max(0, runNonNegativeInteger(keys[kind] ?? 0) + runFiniteIntegerDelta(amount))
});

export const getFloorHeldDungeonKeyCount = (
    board: Pick<BoardState, 'dungeonKeysHeld' | 'dungeonKeysHeldByKind'> | null | undefined,
    kind: DungeonKeyKind
): number =>
    runNonNegativeInteger(board?.dungeonKeysHeldByKind?.[kind]) +
    (board?.dungeonKeysHeldByKind == null && kind === 'iron'
        ? runNonNegativeInteger(board?.dungeonKeysHeld)
        : 0);
