import { describe, expect, it } from 'vitest';
import { addRunDungeonKey, getFloorHeldDungeonKeyCount } from './dungeon-key-rules';

describe('dungeon-key-rules', () => {
    it('adds keys without mutating the original inventory', () => {
        const keys = { iron: 1 };

        expect(addRunDungeonKey(keys, 'iron', 2)).toEqual({ iron: 3 });
        expect(keys).toEqual({ iron: 1 });
    });

    it('clamps key counts at zero when spending more than held', () => {
        expect(addRunDungeonKey({ treasure: 1 }, 'treasure', -3)).toEqual({ treasure: 0 });
        expect(addRunDungeonKey({}, 'boss', -1)).toEqual({ boss: 0 });
    });

    it('normalizes malformed key counts and deltas before updating inventory', () => {
        expect(addRunDungeonKey({ treasure: Number.NaN }, 'treasure', 2.9)).toEqual({ treasure: 2 });
        expect(addRunDungeonKey({ boss: Number.POSITIVE_INFINITY }, 'boss', -1.9)).toEqual({ boss: 0 });
        expect(addRunDungeonKey({ shrine: 1.9 }, 'shrine', Number.NaN)).toEqual({ shrine: 1 });
    });

    it('preserves unrelated key counts', () => {
        expect(addRunDungeonKey({ iron: 2, shrine: 1 }, 'trap', 1)).toEqual({
            iron: 2,
            shrine: 1,
            trap: 1
        });
    });

    it('counts typed floor-held keys with legacy iron fallback only when typed keys are absent', () => {
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeld: 2 }, 'iron')).toBe(2);
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeld: 2 }, 'treasure')).toBe(0);
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeld: 2, dungeonKeysHeldByKind: { treasure: 1 } }, 'iron')).toBe(0);
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeld: 2, dungeonKeysHeldByKind: { treasure: 1 } }, 'treasure')).toBe(1);
    });

    it('normalizes malformed floor-held key counters', () => {
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeld: Number.POSITIVE_INFINITY }, 'iron')).toBe(0);
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeldByKind: { shrine: 1.9 } }, 'shrine')).toBe(1);
        expect(getFloorHeldDungeonKeyCount({ dungeonKeysHeldByKind: { boss: Number.NaN } }, 'boss')).toBe(0);
        expect(getFloorHeldDungeonKeyCount(undefined, 'trap')).toBe(0);
    });
});
