import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { cardStatusMark } from './realmTileMarkKey';

const tile = (over: Partial<Tile>): Tile => ({ id: over.id ?? 't', pairKey: 'a', state: 'hidden', symbol: 'A', ...over }) as Tile;

describe('the realm marks are painted before play', () => {
    beforeEach(() => vi.resetModules());

    it('paints every count an Hourglass ticks down through and every element a Turncoat turns to, on both faces', async () => {
        const { prewarmRealmTileMarks, realmTileMarkTexture } = await import('./realmTileMarkTextures');
        const upload = vi.fn();
        const painted = prewarmRealmTileMarks([tile({ id: 'h', hourglass: 4 }), tile({ id: 'c', turncoat: 'ember' }), tile({ id: 'm', state: 'matched', hourglass: 9 })], upload);
        expect(painted).toBeGreaterThanOrEqual(4 * 2 + 4 * 2);
        expect(upload).toHaveBeenCalledTimes(painted);
        // Nothing the floor can reach is drawn mid-play: a later tick is already in the cache.
        const create = vi.spyOn(document, 'createElement');
        realmTileMarkTexture({ frost: 0, snowed: false, fuse: 0, vined: false, bloom: false, rime: false, seeded: 0, openingLocked: false, hourglass: 2 }, true);
        realmTileMarkTexture({ frost: 0, snowed: false, fuse: 0, vined: false, bloom: false, rime: false, seeded: 0, openingLocked: false, turncoat: 'moss' }, false);
        expect(create).not.toHaveBeenCalledWith('canvas');
        create.mockRestore();
        // A second warm-up of the same floor paints nothing new.
        expect(prewarmRealmTileMarks([tile({ id: 'h', hourglass: 4 })])).toBe(0);
    });

    it('keeps expired sand, thawing frost and burning fuses cached with and without an opening lock', async () => {
        const { prewarmRealmTileMarks, realmTileMarkTexture } = await import('./realmTileMarkTextures');
        prewarmRealmTileMarks([tile({ hourglass: 3, frost: 2, fuse: 3, turncoat: 'tide' })]);
        const create = vi.spyOn(document, 'createElement');
        for (const hourglass of [undefined, 1, 2, 3]) {
            for (const frost of [0, 1, 2]) for (const fuse of [0, 1, 2, 3]) {
                for (const turncoat of ['ember', 'tide', 'moss', 'bone'] as const) {
                    for (const locked of [false, true]) for (const faceUp of [false, true]) {
                        const mark = cardStatusMark(tile({ hourglass, frost, fuse, turncoat }), locked)!;
                        realmTileMarkTexture(mark, faceUp);
                    }
                }
            }
        }
        expect(create).not.toHaveBeenCalledWith('canvas');
    });

    it('uploads shared textures for a new renderer without painting again or warming departed cards', async () => {
        const { prewarmRealmTileMarks } = await import('./realmTileMarkTextures');
        expect(prewarmRealmTileMarks([tile({ state: 'matched', hourglass: 9 }), tile({ state: 'removed', frost: 9 })])).toBe(0);
        const firstUpload = vi.fn();
        const board = [tile({ hourglass: 2 }), tile({ hourglass: 2 })];
        const painted = prewarmRealmTileMarks(board, firstUpload);
        expect(firstUpload).toHaveBeenCalledTimes(painted);
        const nextUpload = vi.fn();
        const create = vi.spyOn(document, 'createElement');
        expect(prewarmRealmTileMarks(board, nextUpload)).toBe(0);
        expect(nextUpload.mock.calls).toEqual(firstUpload.mock.calls);
        expect(create).not.toHaveBeenCalledWith('canvas');
    });
});
