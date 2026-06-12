import { describe, expect, it } from 'vitest';
import {
    DECOY_PAIR_KEY,
    EXIT_PAIR_KEY,
    ROOM_PAIR_KEY,
    SHOP_PAIR_KEY,
    SINGLETON_UTILITY_PAIR_KEYS,
    WILD_PAIR_KEY,
    isSingletonUtilityPairKey
} from './tile-identity';

describe('tile-identity', () => {
    it('classifies singleton utility pair keys from one source of truth', () => {
        expect([...SINGLETON_UTILITY_PAIR_KEYS].sort()).toEqual(
            [DECOY_PAIR_KEY, WILD_PAIR_KEY, EXIT_PAIR_KEY, SHOP_PAIR_KEY, ROOM_PAIR_KEY].sort()
        );
        expect(isSingletonUtilityPairKey(DECOY_PAIR_KEY)).toBe(true);
        expect(isSingletonUtilityPairKey('A')).toBe(false);
    });
});
