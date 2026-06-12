import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { initialTileBoardCardTint } from './tileBoardInitialCardTint';

const tile = (state: Tile['state'] = 'hidden'): Tile =>
    ({
        id: 'tile-a',
        pairKey: 'pair-a',
        label: 'A',
        state
    }) as Tile;

describe('tileBoardInitialCardTint', () => {
    it('uses the pinned hidden tint before dynamic frame tinting starts', () => {
        expect(
            initialTileBoardCardTint({
                faceUp: false,
                isPinned: true,
                resolvingSelection: null,
                tile: tile('hidden')
            })
        ).toBe('#d4b870');
    });

    it('uses resolving face tints only when the card is face up', () => {
        expect(
            initialTileBoardCardTint({
                faceUp: true,
                isPinned: false,
                resolvingSelection: 'mismatch',
                tile: tile('flipped')
            })
        ).toBe('#ffb4a6');
        expect(
            initialTileBoardCardTint({
                faceUp: true,
                isPinned: false,
                resolvingSelection: 'gambitNeutral',
                tile: tile('flipped')
            })
        ).toBe('#cfe8f2');
        expect(
            initialTileBoardCardTint({
                faceUp: false,
                isPinned: false,
                resolvingSelection: 'mismatch',
                tile: tile('hidden')
            })
        ).toBe('#ffffff');
    });

    it('falls back to neutral white for normal card states', () => {
        expect(
            initialTileBoardCardTint({
                faceUp: true,
                isPinned: false,
                resolvingSelection: null,
                tile: tile('flipped')
            })
        ).toBe('#ffffff');
    });
});
