import { describe, expect, it } from 'vitest';
import type { Tile } from '../../shared/contracts';
import { hourglassAnnouncement, hourglassCalloutSub, hourglassLegend, oddCardLegend, turncoatLegend } from './oddCardBeat';

const tile = (id: string, pairKey: string, extra: Partial<Tile> = {}): Tile => ({ id, pairKey, symbol: 'A', label: 'A', state: 'hidden', suit: 'ember', ...extra });

describe('oddCardBeat', () => {
    it('says what a Turncoat is and will be', () => {
        expect(turncoatLegend('ember', 'tide')).toBe('A pair that changes element every turn. Fire now, Water next.');
        expect(turncoatLegend('bone', 'bone')).toBe('A pair that changes element every turn. Frost now.');
    });

    it('says the prize and the sand', () => {
        expect(hourglassLegend(4)).toBe('Match its pair within 4 turns for 3 gold and bonus score.');
        expect(hourglassLegend(1)).toBe('Match its pair within 1 turn for 3 gold and bonus score.');
    });

    it('announces a catch and a run-out', () => {
        const caught = { key: 'hourglass:6:2', kind: 'caught' as const, pairs: 1, gold: 3, score: 60 };
        expect(hourglassAnnouncement(caught)).toBe('Hourglass caught: 3 gold and 60 score.');
        expect(hourglassCalloutSub(caught)).toBe('+3 gold, +60 score');
        expect(hourglassAnnouncement({ ...caught, kind: 'spent', gold: 0, score: 0 })).toBe('The hourglass ran out. Its pair is a plain pair now.');
    });

    it('lists only the odd cards still standing', () => {
        const tiles = [
            tile('a1', 'a', { turncoat: 'tide' }),
            tile('a2', 'a', { turncoat: 'tide' }),
            tile('b1', 'b', { hourglass: 3 }),
            tile('b2', 'b', { hourglass: 3 }),
            tile('c1', 'c')
        ];
        expect(oddCardLegend(tiles).map((entry) => [entry.id, entry.suit, entry.sand])).toEqual([['turncoat', 'ember', null], ['hourglass', null, 3]]);
        expect(oddCardLegend(tiles.map((t) => (t.pairKey === 'a' ? { ...t, state: 'matched' as const } : t))).map((entry) => entry.id)).toEqual(['hourglass']);
        expect(oddCardLegend([tile('c1', 'c')])).toEqual([]);
    });
});
