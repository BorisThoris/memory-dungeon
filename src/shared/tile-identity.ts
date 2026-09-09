export const WILD_PAIR_KEY = '__wild__';

/**
 * Cards that carry no partner. The wild joker is the last of them: the exit, the lever, the shop
 * door and the glass decoy were all singletons too, and every one of them left with the dungeon
 * layer and the fake cards (Gen 173-176, Gen 196). See `docs/REMOVED_DECOY.md`.
 */
export const SINGLETON_UTILITY_PAIR_KEYS = new Set([WILD_PAIR_KEY]);

export const isSingletonUtilityPairKey = (pairKey: string): boolean => SINGLETON_UTILITY_PAIR_KEYS.has(pairKey);

export const isWildPairKey = (pairKey: string): boolean => pairKey === WILD_PAIR_KEY;
