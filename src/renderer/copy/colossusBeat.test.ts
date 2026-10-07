import { describe, expect, it } from 'vitest';
import type { ColossusEvent, ColossusState } from '../../shared/contracts';
import { colossusBeatLine, colossusCalloutSub, colossusCardLabel } from './colossusBeat';

const event = (extra: Partial<ColossusEvent>): ColossusEvent => ({ key: 'colossus:7:1', kind: 'turn', element: 'ember', hits: 0, hitsLeft: 2, turnsLeft: 5, pairs: 0, ...extra });
const standing: ColossusState = { cycle: ['ember', 'tide'], step: 0, hits: 2, hitsMax: 2, chips: 0, turnsLeft: 6, turnsMax: 6, status: 'standing' };

describe('colossusBeat', () => {
    it('labels the card with its element, the next, the hits and the clock', () => {
        expect(colossusCardLabel(standing, 'ember', 'tide')).toBe('Colossus: showing Fire, Water next. 2 hits to fell it, 6 turns left.');
        expect(colossusCardLabel({ ...standing, hits: 1, turnsLeft: 1 }, 'tide', 'ember')).toBe('Colossus: showing Water, Fire next. 1 hit to fell it, 1 turn left.');
        expect(colossusCardLabel({ ...standing, status: 'felled' }, 'ember', 'tide')).toBe('Colossus: felled.');
        expect(colossusCardLabel({ ...standing, status: 'split' }, 'ember', 'tide')).toBe('Colossus: it split and is gone.');
    });

    it('says what each kind of turn did, and what it turns to', () => {
        expect(colossusBeatLine(event({ kind: 'hit', hits: 1, hitsLeft: 1 }), 'tide')).toBe('1 hit on the Colossus. 1 hit to go, 5 turns left. It turns to Water.');
        expect(colossusBeatLine(event({ kind: 'chip' }), 'bone')).toBe('A chip on the Colossus: one more is a hit. 2 hits to go, 5 turns left. It turns to Frost.');
        expect(colossusBeatLine(event({ kind: 'turn', turnsLeft: 1 }), 'moss')).toBe('The Colossus turns. 2 hits to go, 1 turn left. It turns to Grove.');
        expect(colossusBeatLine(event({ kind: 'felled', hitsLeft: 0 }), null)).toBe('The Colossus falls. It pays score and gold.');
        expect(colossusBeatLine(event({ kind: 'split', pairs: 2, turnsLeft: 0 }), null)).toBe('Out of time: the Colossus splits into 2 new pairs, face up until your next flip.');
    });

    it('gives the stamp a second line', () => {
        expect(colossusCalloutSub(event({ kind: 'felled' }))).toMatch(/Score and gold/);
        expect(colossusCalloutSub(event({ kind: 'split', pairs: 1 }))).toBe('1 new pair on the board, face up until your next flip');
    });
});
