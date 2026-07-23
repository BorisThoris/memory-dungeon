import { describe, expect, it } from 'vitest';
import {
    getAllCardIllustrationUrls,
    getCardIllustrationRegistryUrlRows,
    LEGACY_SVG_ILLUSTRATION_URLS
} from './cardIllustrationRegistry';
import type { CardIllustrationRegistry } from './resolveCardIllustrationUrl';

describe('cardIllustrationRegistry preload rows', () => {
    it('collects registry maps in stable key order before declared pools and legacy art', () => {
        const registry: CardIllustrationRegistry = {
            bySymbol: {
                z: 'symbol-z.png',
                a: 'symbol-a.png',
                empty: ''
            },
            bySymbolVariant: {
                '9|1': 'variant-9.png',
                '1|1': 'variant-1.png'
            },
            numericFallbackPool: ['num-a.png', 'shared.png'],
            nonDigitFallbackPool: ['symbol-fallback.png', 'shared.png']
        };

        expect(getCardIllustrationRegistryUrlRows(registry)).toEqual([
            'symbol-a.png',
            'symbol-z.png',
            'variant-1.png',
            'variant-9.png',
            'num-a.png',
            'shared.png',
            'symbol-fallback.png',
            'shared.png',
            ...LEGACY_SVG_ILLUSTRATION_URLS
        ]);
    });

    it('dedupes the default preload URL list without dropping declared legacy art', () => {
        const urls = getAllCardIllustrationUrls();

        expect(new Set(urls).size).toBe(urls.length);
        for (const url of LEGACY_SVG_ILLUSTRATION_URLS) {
            expect(urls).toContain(url);
        }
    });
});
