export const COSMETIC_IDS = [
    'title_seeker',
    'crest_lantern',
    'card_back_classic',
    'crest_daily_bronze',
    'title_ascendant_v'
] as const;

export type CosmeticId = (typeof COSMETIC_IDS)[number];

