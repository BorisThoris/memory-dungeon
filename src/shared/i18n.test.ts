import { afterEach, describe, expect, it } from 'vitest';
import { matchShippingLocale, plural, pseudoLocalize, setActiveLocale, templateKey, tr } from './i18n';

afterEach(() => setActiveLocale('en', null));

describe('tr', () => {
    it('returns the English unchanged with no catalog', () => {
        const floor = 7;
        expect(tr`Floor ${floor} cleared.`).toBe('Floor 7 cleared.');
        expect(tr.s('Descend')).toBe('Descend');
    });

    it('keys a template by its literal parts', () => {
        const key = ((strings: TemplateStringsArray, ..._values: unknown[]) => templateKey(strings))`A ${1} b ${2} c`;
        expect(key).toBe('A {0} b {1} c');
    });

    it('translates through the catalog and reorders placeholders', () => {
        setActiveLocale('de', { 'Floor {0} of {1}': 'Ebene {0} von {1}', Descend: 'Hinabsteigen', 'Gold {0}, floor {1}': 'Ebene {1}: {0} Gold' });
        expect(tr`Floor ${3} of ${40}`).toBe('Ebene 3 von 40');
        expect(tr`Gold ${12}, floor ${3}`).toBe('Ebene 3: 12 Gold');
        expect(tr.s('Descend')).toBe('Hinabsteigen');
        // A key the catalog lacks falls back to English rather than showing nothing.
        expect(tr.s('Camp')).toBe('Camp');
    });

    it('pseudo-localizes without touching placeholders', () => {
        expect(pseudoLocalize('Floor {0}')).toMatch(/^\[Flöör \{0\}~+\]$/u);
        setActiveLocale('en-XA', null);
        expect(tr`Floor ${4}`).toContain('4');
    });
});

describe('plural', () => {
    it('picks English one/other', () => {
        expect(plural(1, { one: '{0} pair', other: '{0} pairs' })).toBe('1 pair');
        expect(plural(5, { one: '{0} pair', other: '{0} pairs' })).toBe('5 pairs');
    });

    it('uses the catalog\'s own categories for Russian', () => {
        setActiveLocale('ru', {
            '{0} pairs#one': '{0} пара',
            '{0} pairs#few': '{0} пары',
            '{0} pairs#many': '{0} пар'
        });
        const forms = { one: '{0} pair', other: '{0} pairs' };
        expect(plural(1, forms)).toBe('1 пара');
        expect(plural(3, forms)).toBe('3 пары');
        expect(plural(11, forms)).toBe('11 пар');
        expect(plural(21, forms)).toBe('21 пара');
    });
});

describe('matchShippingLocale', () => {
    it('matches regions, scripts and falls back to English', () => {
        expect(matchShippingLocale(['de-AT'])).toBe('de');
        expect(matchShippingLocale(['pt-PT'])).toBe('pt-BR');
        expect(matchShippingLocale(['zh-CN'])).toBe('zh-Hans');
        expect(matchShippingLocale(['zh-TW', 'fr-CA'])).toBe('fr');
        expect(matchShippingLocale(['ja-JP'])).toBe('en');
        expect(matchShippingLocale([])).toBe('en');
    });
});
