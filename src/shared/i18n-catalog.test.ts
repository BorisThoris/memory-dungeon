import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkCatalogs, extractKeys, requiredKeysFor } from '../../scripts/i18n-catalog';
import { looksLikeCode } from '../../scripts/i18n-unwrap-ids';

/*
 * Every shipping language holds every key the code uses, with the same placeholders, and nothing
 * stale (docs/LOCALIZATION_PLAN.md). A new or changed `tr` string fails here until
 * `yarn i18n:extract` has run and each catalog has its translation.
 */
describe('translation catalogs', () => {
    const extracted = extractKeys();

    it('src/locales/en.json lists exactly the keys the code uses', () => {
        const english = JSON.parse(readFileSync(join(process.cwd(), 'src/locales/en.json'), 'utf8')) as Record<string, string>;
        expect(Object.keys(english).sort()).toEqual(requiredKeysFor('en', extracted));
    }, 60_000);

    it('every shipping language is complete and keeps its placeholders', () => {
        expect(checkCatalogs(extracted).slice(0, 20)).toEqual([]);
    }, 60_000);

    it('wraps no code: shader source, CSS values and media queries never reach a translator', () => {
        expect([...extracted.keys.keys()].filter(looksLikeCode)).toEqual([]);
    }, 60_000);
});
