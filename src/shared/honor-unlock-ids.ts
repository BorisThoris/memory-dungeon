export const HONOR_UNLOCK_IDS = [
    'honor_sharp_initiate',
    'honor_ascendant_5',
    'honor_ascendant_10',
    'honor_score_maestro',
] as const;

export type HonorUnlockId = (typeof HONOR_UNLOCK_IDS)[number];

