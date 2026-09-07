import { describe, expect, it } from 'vitest';
import type { Tile } from './contracts';
import {
    hiddenUnlessSprungTrap,
    isSprungTrapTile
} from './tile-state-rules';

const tile = (overrides: Partial<Tile> = {}): Tile => ({
    id: 'tile',
    pairKey: 'A',
    symbol: 'A',
    label: 'A',
    state: 'flipped',
    ...overrides
});

describe('tile state rules', () => {
    it('keeps resolved trap cards face-up when resetting flipped tiles', () => {
        const trap = tile({
            dungeonCardKind: 'trap',
            dungeonCardState: 'resolved'
        });

        expect(isSprungTrapTile(trap)).toBe(true);
        expect(hiddenUnlessSprungTrap(trap).state).toBe('flipped');
    });

    it('hides ordinary flipped tiles and armed trap tiles', () => {
        expect(hiddenUnlessSprungTrap(tile()).state).toBe('hidden');
        expect(hiddenUnlessSprungTrap(tile({
            dungeonCardKind: 'trap',
            dungeonCardState: 'hidden'
        })).state).toBe('hidden');
    });

    it('leaves a card that has already left the board where it is', () => {
        // Traps pop off the board when they spring, so a turn that hides its flipped tiles must
        // not drag a removed one back under the player's finger.
        for (const state of ['matched', 'removed'] as const) {
            expect(hiddenUnlessSprungTrap(tile({
                dungeonCardKind: 'trap',
                dungeonCardState: 'resolved',
                state
            })).state).toBe(state);
        }
    });
});
