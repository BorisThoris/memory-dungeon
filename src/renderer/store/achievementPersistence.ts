import type { AchievementId, AchievementUnlockResult, SaveData } from '../../shared/contracts';
import { normalizeUnknownAchievementUnlockResult } from '../../shared/desktop-api-boundary';
import { desktopClient } from '../desktop-client';
import { persistSaveData } from './persistBridge';

/**
 * REF-036: Write the canonical save before `unlock-achievement` IPCs, and unlock sequentially.
 * Parallel unlock handlers each read–modify–write electron-store and can drop sibling achievement flags.
 */
export const persistSaveDataThenUnlockAchievements = async (
    saveData: SaveData,
    achievementIds: AchievementId[]
): Promise<{ failures: { id: AchievementId; result: AchievementUnlockResult }[] }> => {
    await persistSaveData(saveData);
    const failures: { id: AchievementId; result: AchievementUnlockResult }[] = [];
    for (const achievementId of achievementIds) {
        const result = normalizeUnknownAchievementUnlockResult(await desktopClient.unlockAchievement(achievementId));
        if (!result.ok) {
            failures.push({ id: achievementId, result });
            console.warn('[achievements] Steam bridge did not report success', achievementId, result);
        }
    }
    return { failures };
};
