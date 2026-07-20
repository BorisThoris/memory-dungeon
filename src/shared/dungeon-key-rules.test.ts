import { describe, expect, it } from 'vitest';
import { addRunDungeonKey } from './dungeon-key-rules';

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
});
