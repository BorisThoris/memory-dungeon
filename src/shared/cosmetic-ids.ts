export const COSMETIC_IDS = [
    'title_seeker',
    'crest_lantern',
    'card_back_classic',
    'crest_daily_bronze',
    'title_ascendant_v',
    // The feats' titles (`feat-unlocks.ts`, DGE-024).
    'title_twelve_held',
    'title_warden_feller',
    'title_alchemist',
    'title_mason',
    'title_encore',
    'title_ring_walker',
    'title_night_watch',
    'title_hallbreaker',
    'title_map_burner',
    'title_unmasker'
] as const;

export type CosmeticId = (typeof COSMETIC_IDS)[number];

