import { describe, expect, it } from 'vitest';
import { makeTile } from '../../shared/test/game-fixtures';
import { unmaskedCells } from './unmaskedCells';

describe('a mask drops (DGE-016)', () => {
    it('finds the card that turned to an element its back did not show', () => {
        const before = { tiles: [makeTile('a-1', 'a', 'a', { suit: 'tide' }), makeTile('b-1', 'b', 'b', { suit: 'moss' })] };
        const after = { tiles: [makeTile('a-1', 'a', 'a', { suit: 'ember', state: 'flipped' }), makeTile('b-1', 'b', 'b', { suit: 'moss', state: 'flipped' })] };
        expect(unmaskedCells(before, after)).toEqual([0]);
        expect(unmaskedCells(null, after)).toEqual([]);
        expect(unmaskedCells(after, after)).toEqual([]);
    });
});
