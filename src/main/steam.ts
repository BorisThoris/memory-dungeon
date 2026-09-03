/**
 * Steamworks bridge (optional).
 *
 * - **Init failure** (missing DLL, wrong `STEAM_APP_ID`, API unavailable): `createSteamAdapter` catches and returns
 *   {@link createMockSteamAdapter} — the app keeps running; renderer sees `isSteamConnected() === false`.
 * - **Achievement unlock**: never throws to IPC callers; returns structured {@link AchievementUnlockResult}. Partner must define matching API Names for every `AchievementId` (see `STEAM_ACHIEVEMENT_API_NAME`).
 * - **Overlay**: `electronEnableSteamOverlay` is best-effort when the API exists.
 *
 * Non-Steam dev builds and web renderer use the mock adapter via preload (`desktopClient`); no Steam install required.
 */
import * as steamworks from 'steamworks.js';
import type { AchievementId, AchievementUnlockResult } from '../shared/contracts';
import { parseSteamAppId } from './steam-app-id';

export interface SteamAdapter {
    isConnected(): boolean;
    unlockAchievement(achievementId: AchievementId): AchievementUnlockResult;
}

/**
 * Steamworks `achievement.activate` expects the **API Name** from the Steamworks Partner site
 * (Stats & Achievements). These are currently identical to `AchievementId`; if Partner names differ,
 * update this map only — keep `AchievementId` / save data unchanged.
 */
const STEAM_ACHIEVEMENT_API_NAME = {
    ACH_FIRST_CLEAR: 'ACH_FIRST_CLEAR', // Partner API Name (identity unless dashboard differs)
    ACH_LAST_LIFE: 'ACH_LAST_LIFE',
    ACH_LEVEL_FIVE: 'ACH_LEVEL_FIVE',
    ACH_PERFECT_CLEAR: 'ACH_PERFECT_CLEAR',
    ACH_SCORE_THOUSAND: 'ACH_SCORE_THOUSAND',
    ACH_ENDLESS_TEN: 'ACH_ENDLESS_TEN',
    ACH_SEVEN_DAILIES: 'ACH_SEVEN_DAILIES',
    ACH_WARDEN_FELLED: 'ACH_WARDEN_FELLED',
    ACH_ENDLESS_CYCLE: 'ACH_ENDLESS_CYCLE',
    ACH_ENDLESS_TWENTY: 'ACH_ENDLESS_TWENTY',
    ACH_SCORE_TEN_THOUSAND: 'ACH_SCORE_TEN_THOUSAND',
    ACH_STREAK_TEN: 'ACH_STREAK_TEN',
    ACH_TRAIT_SCHOLAR: 'ACH_TRAIT_SCHOLAR',
    ACH_RELIC_HOARD: 'ACH_RELIC_HOARD',
    ACH_STANDING_ORDERS: 'ACH_STANDING_ORDERS',
    ACH_RELIC_LIBRARY: 'ACH_RELIC_LIBRARY',
    ACH_NO_POWERS_TEN: 'ACH_NO_POWERS_TEN',
    ACH_GAUNTLET_RUN: 'ACH_GAUNTLET_RUN',
    ACH_PUZZLE_SOLVER: 'ACH_PUZZLE_SOLVER',
    ACH_MEDITATION_HOUR: 'ACH_MEDITATION_HOUR'
} as const satisfies Record<AchievementId, string>;

const createMockSteamAdapter = (): SteamAdapter => ({
    isConnected: () => false,
    unlockAchievement: () => ({ ok: false, reason: 'not_connected' })
});

export interface SteamAdapterOptions {
    /** Off in the demo flavour (Valve's recommendation); unlock calls then report `achievements_disabled`. */
    achievementsEnabled?: boolean;
}

export const createSteamAdapter = ({ achievementsEnabled = true }: SteamAdapterOptions = {}): SteamAdapter => {
    try {
        const rawAppId = process.env.STEAM_APP_ID;
        const appId = parseSteamAppId(rawAppId);
        if (rawAppId !== undefined && appId === undefined) {
            throw new Error('STEAM_APP_ID must be a positive decimal uint32 value.');
        }
        const client = appId === undefined ? steamworks.init() : steamworks.init(appId);

        if (typeof steamworks.electronEnableSteamOverlay === 'function') {
            steamworks.electronEnableSteamOverlay();
        }

        return {
            isConnected: () => true,
            unlockAchievement: (achievementId): AchievementUnlockResult => {
                if (!achievementsEnabled) {
                    return { ok: false, reason: 'steam_rejected', detail: 'achievements_disabled' };
                }
                try {
                    const apiName = STEAM_ACHIEVEMENT_API_NAME[achievementId];
                    const activated = client.achievement.activate(apiName);
                    if (!activated) {
                        console.warn('[steam] achievement.activate returned false', achievementId);
                        return { ok: false, reason: 'steam_rejected', detail: 'activate_returned_false' };
                    }
                    return { ok: true };
                } catch (error) {
                    console.warn('[steam] achievement unlock failed', achievementId, error);
                    return {
                        ok: false,
                        reason: 'steam_rejected',
                        detail: 'activation_error'
                    };
                }
            }
        };
    } catch (error) {
        console.warn('[steam] steamworks unavailable, using mock adapter', error);
        return createMockSteamAdapter();
    }
};
