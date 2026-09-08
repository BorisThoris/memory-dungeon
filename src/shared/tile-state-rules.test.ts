import { describe, expect, it } from 'vitest';
import type { Tile } from './contracts';
import { hideTileAfterTurn, isSprungTrapTile } from './tile-state-rules';

const tile = (overrides: Partial<Tile> = {}): Tile => ({
    id: 'tile',
    pairKey: 'A',
    symbol: 'A',
    label: 'A',
    state: 'flipped',
    ...overrides
});

describe('tile state rules', () => {
    it('hides a flipped tile after the turn it took part in', () => {
        expect(hideTileAfterTurn(tile()).state).toBe('hidden');
        expect(hideTileAfterTurn(tile({ state: 'hidden' })).state).toBe('hidden');
    });

    it('leaves a card that has already left the board where it is', () => {
        // A turn that hides its flipped tiles must not drag a matched or popped one back under
        // the player's finger.
        for (const state of ['matched', 'removed'] as const) {
            expect(hideTileAfterTurn(tile({ state })).state).toBe(state);
        }
    });

    it('never reads a tile as a sprung trap', () => {
        expect(isSprungTrapTile(tile())).toBe(false);
    });
});
