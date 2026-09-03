/**
 * The line under the Collection heading that says where this progress actually lives.
 *
 * It matters for achievements specifically: a player who unlocks something wants to know whether
 * Steam has it too, and the answer is different depending on whether the game found Steam at
 * launch. Saying "stored on this device" unconditionally was wrong half the time.
 */
export const collectionStorageNote = ({
    isAchievements,
    steamConnected
}: {
    isAchievements: boolean;
    steamConnected: boolean;
}): string => {
    if (!isAchievements) {
        return 'everything here is stored on this device.';
    }
    return steamConnected
        ? 'these unlock on Steam as well as on this device.'
        : 'Steam is not connected, so these stay on this device until it is.';
};
