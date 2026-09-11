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
    ACH_LAST_LIFE: 'ACH_LAST_LIFE',
    ACH_LEVEL_FIVE: 'ACH_LEVEL_FIVE',
    ACH_FIRST_FEVER: 'ACH_FIRST_FEVER',
    ACH_CHUNK_SIX: 'ACH_CHUNK_SIX',
    ACH_EXTREME_FEVER: 'ACH_EXTREME_FEVER',
    ACH_NOTHING_HELD_IT: 'ACH_NOTHING_HELD_IT',
    ACH_CHAIN_REACTION: 'ACH_CHAIN_REACTION',
    ACH_RUNS_FIVE: 'ACH_RUNS_FIVE',
    ACH_RUNS_TEN: 'ACH_RUNS_TEN',
    ACH_RUNS_TWENTY_FIVE: 'ACH_RUNS_TWENTY_FIVE',
    ACH_RUNS_FIFTY: 'ACH_RUNS_FIFTY',
    ACH_RUNS_HUNDRED: 'ACH_RUNS_HUNDRED',
    ACH_NO_POWERS_TEN: 'ACH_NO_POWERS_TEN',
    ACH_PERFECT_CLEAR: 'ACH_PERFECT_CLEAR',
    ACH_SCORE_TEN_THOUSAND: 'ACH_SCORE_TEN_THOUSAND',
    ACH_SCORE_THOUSAND: 'ACH_SCORE_THOUSAND',
    ACH_STREAK_TEN: 'ACH_STREAK_TEN',
    ACH_TRAIT_SCHOLAR: 'ACH_TRAIT_SCHOLAR'
} as const satisfies Record<AchievementId, string>;
