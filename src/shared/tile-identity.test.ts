import { describe, expect, it } from 'vitest';
import {
    SINGLETON_UTILITY_PAIR_KEYS,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey,
    isWildPairKey
} from './tile-identity';

describe('tile-identity', () => {
    it('carries exactly one singleton, the wild joker', () => {
        expect([...SINGLETON_UTILITY_PAIR_KEYS]).toEqual([WILD_PAIR_KEY]);
    });

    it('reads the wild joker as a singleton and everything else as a real pair half', () => {
        expect(isSingletonUtilityPairKey(WILD_PAIR_KEY)).toBe(true);
        expect(isWildPairKey(WILD_PAIR_KEY)).toBe(true);

        for (const pairKey of ['ember_3', '__exit__', '__decoy__', '__shop__', '']) {
            expect(isSingletonUtilityPairKey(pairKey), pairKey).toBe(false);
            expect(isWildPairKey(pairKey), pairKey).toBe(false);
        }
    });
});
