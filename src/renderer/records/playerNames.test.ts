import { describe, expect, it } from 'vitest';
import { clean, reject } from './playerNames.mjs';
describe('Bobball name moderation', () => {
    it.each(['s.h.1.t', 'shiiit', 'fuсk', 'ｆｕｃｋ', 'сука', 'f\u200buck', 'example.com', '1488', '💦'])('rejects %s', name => {
        expect(reject(name)).not.toBeNull();
    });
    it.each(['Nick Gera', 'N1ck.G3ra', 'Nіck Gеra', 'Nick\u200bGera', 'Nick Gurr', 'Knee Grow', 'Mike Hunt', 'Ben Dover', 'Hugh Jass', 'Phil McCracken', 'Jack Goff', 'Sir Nick Gera', 'Ben Dover Jr'])('rejects fake-name soundalikes such as %s', name => {
        expect(reject(name)).not.toBeNull();
    });
    it.each(['Ada', 'Boris', 'Cassandra', 'Kurt', 'Nigel', 'Essex', 'Nick Miller', 'Ben Mason', 'Mike Hunter', 'Hugh Grant', 'Phil Taylor', 'Captain Pickle'])('keeps ordinary names such as %s', name => {
        expect(reject(name)).toBeNull();
    });
    it('uses the same cleaned 16-character public name as Bobball', () => {
        expect(clean('  Ada  Lovelace  ')).toBe('Ada Lovelace');
        expect(clean('A'.repeat(30))).toHaveLength(16);
        expect(reject('1')).not.toBeNull();
    });
});
