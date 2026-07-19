export const HONOR_UNLOCK_IDS = [
    'honor_daily_initiate',
    'honor_daily_streak_3',
    'honor_daily_streak_7',
    'honor_ascendant_5',
    'honor_ascendant_10',
    'honor_score_maestro',
    'honor_relic_habit',
    'honor_gauntlet_proof'
] as const;

export type HonorUnlockId = (typeof HONOR_UNLOCK_IDS)[number];

