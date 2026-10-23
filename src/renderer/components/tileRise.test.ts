import { describe, expect, it } from 'vitest';
import { makeTile } from '../../shared/test/game-fixtures';
import { isCardGliding, primeCardRise, RISE_SHAPE, sampleCellGlide } from './tileCellGlide';
import { noteRisenCards, takeRisen } from './tileRise';

describe('a card rises from the deck beneath (DGE-017)', () => {
    it('notes a card that was beneath and is on top now, once', () => {
        noteRisenCards({ beneath: [makeTile('low-1', 'l', 'l'), null], tiles: [] }, { tiles: [makeTile('low-1', 'l', 'l'), makeTile('top-2', 't', 't')] });
        expect(takeRisen('top-2')).toBe(false);
        expect(takeRisen('low-1')).toBe(true);
        expect(takeRisen('low-1')).toBe(false);
    });

    it('notes a Sleeper that woke: gone on the last board, face down now', () => {
        noteRisenCards({ tiles: [makeTile('s-1', 's', 's', { state: 'matched' }), makeTile('m-1', 'm', 'm', { state: 'matched' })] }, { tiles: [makeTile('s-1', 's', 's'), makeTile('m-1', 'm', 'm', { state: 'matched' })] });
        expect(takeRisen('s-1')).toBe(true);
        expect(takeRisen('m-1')).toBe(false);
    });

    it('climbs from the edge into its cell over the rise, then stops', () => {
        const card = {};
        primeCardRise(card, { x: 1.06, y: -0.06 }, { x: 1, y: 0 }, 1000);
        expect(isCardGliding(card)).toBe(true);
        const mid = sampleCellGlide(card, { x: 1, y: 0, z: 0 }, { x: 1.06, y: -0.06, z: 0 }, 1000 + RISE_SHAPE.ms / 2, false)!;
        expect(mid.x).toBeGreaterThan(1);
        expect(mid.lift).toBeGreaterThan(0);
        expect(sampleCellGlide(card, { x: 1, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1000 + RISE_SHAPE.ms + 1, false)).toBeNull();
    });
});
