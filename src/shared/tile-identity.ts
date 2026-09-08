export const DECOY_PAIR_KEY = '__decoy__';
export const WILD_PAIR_KEY = '__wild__';
export const EXIT_PAIR_KEY = '__exit__';

export const SINGLETON_UTILITY_PAIR_KEYS = new Set([DECOY_PAIR_KEY, WILD_PAIR_KEY, EXIT_PAIR_KEY]);

export const isSingletonUtilityPairKey = (pairKey: string): boolean => SINGLETON_UTILITY_PAIR_KEYS.has(pairKey);

export const isWildPairKey = (pairKey: string): boolean => pairKey === WILD_PAIR_KEY;
