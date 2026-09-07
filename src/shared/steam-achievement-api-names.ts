import type { AchievementId } from './contracts';

/**
 * Steamworks `achievement.activate` expects the **API Name** from the Steamworks Partner site
 * (Stats & Achievements). These are currently identical to `AchievementId`; if the Partner dashboard
 * ends up using different names, edit this map only — `AchievementId` and save data stay put.
 *
 * This lives in `shared/` rather than beside the adapter because the adapter imports the native
 * `steamworks.js` binding, which nothing under test can load. The map is the part that has to be
 * checked against `ACHIEVEMENT_IDS`, so it has to be reachable without the binding.
 */
export const STEAM_ACHIEVEMENT_API_NAME = {
    ACH_ENDLESS_CYCLE: 'ACH_ENDLESS_CYCLE',
    ACH_ENDLESS_TEN: 'ACH_ENDLESS_TEN',
    ACH_ENDLESS_TWENTY: 'ACH_ENDLESS_TWENTY',
    ACH_FIRST_CLEAR: 'ACH_FIRST_CLEAR',
    ACH_GAUNTLET_RUN: 'ACH_GAUNTLET_RUN',
    ACH_LAST_LIFE: 'ACH_LAST_LIFE',
    ACH_LEVEL_FIVE: 'ACH_LEVEL_FIVE',
    ACH_MEDITATION_HOUR: 'ACH_MEDITATION_HOUR',
    ACH_FIRST_FEVER: 'ACH_FIRST_FEVER',
    ACH_CHUNK_SIX: 'ACH_CHUNK_SIX',
    ACH_EXTREME_FEVER: 'ACH_EXTREME_FEVER',
    ACH_WARDEN_BY_CHUNK: 'ACH_WARDEN_BY_CHUNK',
    ACH_NOTHING_HELD_IT: 'ACH_NOTHING_HELD_IT',
    ACH_NO_POWERS_TEN: 'ACH_NO_POWERS_TEN',
    ACH_PERFECT_CLEAR: 'ACH_PERFECT_CLEAR',
    ACH_PUZZLE_SOLVER: 'ACH_PUZZLE_SOLVER',
    ACH_RELIC_HOARD: 'ACH_RELIC_HOARD',
    ACH_RELIC_LIBRARY: 'ACH_RELIC_LIBRARY',
    ACH_SCORE_TEN_THOUSAND: 'ACH_SCORE_TEN_THOUSAND',
    ACH_SCORE_THOUSAND: 'ACH_SCORE_THOUSAND',
    ACH_SEVEN_DAILIES: 'ACH_SEVEN_DAILIES',
    ACH_STANDING_ORDERS: 'ACH_STANDING_ORDERS',
    ACH_STREAK_TEN: 'ACH_STREAK_TEN',
    ACH_TRAIT_SCHOLAR: 'ACH_TRAIT_SCHOLAR',
    ACH_WARDEN_FELLED: 'ACH_WARDEN_FELLED'
} as const satisfies Record<AchievementId, string>;
