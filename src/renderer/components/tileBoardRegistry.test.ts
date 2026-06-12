import { describe, expect, it } from 'vitest';

import { createTileBoardItemRegistry } from './tileBoardRegistry';

describe('tileBoardRegistry', () => {
    it('registers and unregisters items in the backing map', () => {
        const items = new Map<string, number>();
        const registry = createTileBoardItemRegistry(items);

        registry.register('tile-a', 1);
        registry.register('tile-b', 2);

        expect([...items.entries()]).toEqual([
            ['tile-a', 1],
            ['tile-b', 2]
        ]);

        registry.unregister('tile-a');

        expect([...items.entries()]).toEqual([['tile-b', 2]]);
    });

    it('replaces existing registrations for the same id', () => {
        const items = new Map<string, { value: number }>();
        const registry = createTileBoardItemRegistry(items);

        registry.register('tile-a', { value: 1 });
        registry.register('tile-a', { value: 2 });

        expect(items.get('tile-a')).toEqual({ value: 2 });
    });

    it('runs register and unregister callbacks after map mutation', () => {
        const items = new Map<string, number>();
        const idleStreaks = new Map<string, number>([['tile-a', 3]]);
        const events: Array<[string, string, number | undefined]> = [];
        const registry = createTileBoardItemRegistry(items, {
            onRegister(id, item) {
                idleStreaks.delete(id);
                events.push(['register', id, items.get(id) ?? item]);
            },
            onUnregister(id) {
                idleStreaks.delete(id);
                events.push(['unregister', id, items.get(id)]);
            }
        });

        registry.register('tile-a', 4);
        registry.unregister('tile-a');

        expect(idleStreaks.has('tile-a')).toBe(false);
        expect(events).toEqual([
            ['register', 'tile-a', 4],
            ['unregister', 'tile-a', undefined]
        ]);
    });
});
