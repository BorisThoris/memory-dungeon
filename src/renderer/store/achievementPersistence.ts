import type { AchievementId, AchievementUnlockResult, SaveData } from '../../shared/contracts';
import { normalizeUnknownAchievementUnlockResult } from '../../shared/desktop-api-boundary';
import { ACHIEVEMENT_IDS } from '../../shared/save-data';
import { desktopClient } from '../desktop-client';
import { persistSaveData } from './persistBridge';

export const ACHIEVEMENT_SYNC_FAILURE_NOTICE =
    'Some achievements could not sync with Steam. Your unlocks are saved in this build.';

type AchievementSyncResult = { failures: { id: AchievementId; result: AchievementUnlockResult }[] };

const unlockAchievementsSequentially = async (achievementIds: AchievementId[]): Promise<AchievementSyncResult> => {
    const failures: AchievementSyncResult['failures'] = [];
    for (const achievementId of new Set(achievementIds)) {
        let result: AchievementUnlockResult;
        try {
            result = normalizeUnknownAchievementUnlockResult(await desktopClient.unlockAchievement(achievementId));
        } catch {
            console.warn('[achievements] Steam bridge invoke failed', achievementId);
            result = { ok: false, reason: 'steam_rejected', detail: 'bridge_error' };
        }
        if (!result.ok) {
            failures.push({ id: achievementId, result });
            console.warn('[achievements] Steam bridge did not report success', achievementId, result);
        }
    }
    return { failures };
};

export const syncPersistedAchievements = async (
    saveData: SaveData,
    steamConnected: boolean
): Promise<AchievementSyncResult> => {
    if (!steamConnected) {
        return { failures: [] };
    }
    return unlockAchievementsSequentially(ACHIEVEMENT_IDS.filter((id) => saveData.achievements[id]));
};

/**
 * REF-036: Write the canonical save before `unlock-achievement` IPCs, and unlock sequentially.
 * Parallel unlock handlers each read–modify–write electron-store and can drop sibling achievement flags.
 */
export const persistSaveDataThenUnlockAchievements = async (
    saveData: SaveData,
    achievementIds: AchievementId[]
): Promise<{ failures: { id: AchievementId; result: AchievementUnlockResult }[] }> => {
    await persistSaveData(saveData);
    return unlockAchievementsSequentially(achievementIds);
};
