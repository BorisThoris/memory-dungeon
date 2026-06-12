import { describe, expect, it, vi } from 'vitest';

import { disposeTileBoardResource, disposeTileBoardResources } from './tileBoardDisposables';

describe('tileBoardDisposables', () => {
    it('disposes a single resource when present', () => {
        const resource = { dispose: vi.fn() };

        disposeTileBoardResource(resource);

        expect(resource.dispose).toHaveBeenCalledTimes(1);
    });

    it('ignores nullish single resources', () => {
        expect(() => disposeTileBoardResource(null)).not.toThrow();
        expect(() => disposeTileBoardResource(undefined)).not.toThrow();
    });

    it('disposes resource lists in order while skipping nullish entries', () => {
        const events: string[] = [];

        disposeTileBoardResources([
            { dispose: () => events.push('a') },
            null,
            { dispose: () => events.push('b') },
            undefined,
            { dispose: () => events.push('c') }
        ]);

        expect(events).toEqual(['a', 'b', 'c']);
    });
});
