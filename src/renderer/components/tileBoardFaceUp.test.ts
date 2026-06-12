import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { isTileBoardFaceUp } from './tileBoardFaceUp';

const tile = (id: string, state: Tile['state'] = 'hidden'): Tile =>
    ({
        id,
        pairKey: id,
        label: id,
        state
    }) as Tile;

const faceUp = (overrides: Partial<Parameters<typeof isTileBoardFaceUp>[0]> = {}): boolean =>
    isTileBoardFaceUp({
        debugPeekActive: false,
        peekRevealedTileIds: new Set(),
        previewActive: false,
        tile: tile('a'),
        ...overrides
    });

describe('tileBoardFaceUp', () => {
    it('shows non-hidden tile states face up', () => {
        expect(faceUp({ tile: tile('a', 'flipped') })).toBe(true);
        expect(faceUp({ tile: tile('a', 'matched') })).toBe(true);
        expect(faceUp({ tile: tile('a', 'removed') })).toBe(true);
    });

    it('shows hidden tiles face up for preview, debug peek, or explicit peek reveal', () => {
        expect(faceUp({ previewActive: true })).toBe(true);
        expect(faceUp({ debugPeekActive: true })).toBe(true);
        expect(faceUp({ peekRevealedTileIds: new Set(['a']) })).toBe(true);
    });

    it('keeps ordinary hidden tiles face down', () => {
        expect(faceUp()).toBe(false);
        expect(faceUp({ peekRevealedTileIds: new Set(['other']) })).toBe(false);
    });
});
