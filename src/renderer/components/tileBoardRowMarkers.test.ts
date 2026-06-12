import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { isMemorizeCurseHighlighted, isStickyFingerSlotMarked } from './tileBoardRowMarkers';

const tile = (overrides: Partial<Tile> = {}): Tile =>
    ({
        id: 'tile-a',
        pairKey: 'pair-a',
        label: 'A',
        state: 'hidden',
        ...overrides
    }) as Tile;

describe('tileBoardRowMarkers', () => {
    it('highlights memorize curse tiles only during preview for matching hidden pairs', () => {
        expect(
            isMemorizeCurseHighlighted({
                cursedPairKey: 'pair-a',
                previewActive: true,
                tile: tile()
            })
        ).toBe(true);

        expect(
            isMemorizeCurseHighlighted({
                cursedPairKey: 'pair-a',
                previewActive: false,
                tile: tile()
            })
        ).toBe(false);

        expect(
            isMemorizeCurseHighlighted({
                cursedPairKey: 'pair-b',
                previewActive: true,
                tile: tile()
            })
        ).toBe(false);

        expect(
            isMemorizeCurseHighlighted({
                cursedPairKey: 'pair-a',
                previewActive: true,
                tile: tile({ state: 'flipped' })
            })
        ).toBe(false);
    });

    it('marks sticky finger slots for the blocked matched tile before any flip', () => {
        expect(
            isStickyFingerSlotMarked({
                faceUp: true,
                flippedTileCount: 0,
                stickyBlockedTileId: 'tile-a',
                tile: tile({ state: 'matched' })
            })
        ).toBe(true);
    });

    it('marks sticky finger slots for blocked hidden face-down tiles before any flip', () => {
        expect(
            isStickyFingerSlotMarked({
                faceUp: false,
                flippedTileCount: 0,
                stickyBlockedTileId: 'tile-a',
                tile: tile()
            })
        ).toBe(true);
    });

    it('does not mark sticky finger slots after a flip, on the wrong tile, or face-up hidden tiles', () => {
        expect(
            isStickyFingerSlotMarked({
                faceUp: false,
                flippedTileCount: 1,
                stickyBlockedTileId: 'tile-a',
                tile: tile()
            })
        ).toBe(false);

        expect(
            isStickyFingerSlotMarked({
                faceUp: false,
                flippedTileCount: 0,
                stickyBlockedTileId: 'other',
                tile: tile()
            })
        ).toBe(false);

        expect(
            isStickyFingerSlotMarked({
                faceUp: true,
                flippedTileCount: 0,
                stickyBlockedTileId: 'tile-a',
                tile: tile()
            })
        ).toBe(false);
    });
});
