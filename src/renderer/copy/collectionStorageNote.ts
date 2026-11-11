/**
 * The line under the Collection heading that says where this progress actually lives.
 *
 * It matters for achievements specifically: a player who unlocks something wants to know whether
 * Steam has it too, and the answer is different depending on whether the game found Steam at
 * launch. Saying "stored on this device" unconditionally was wrong half the time.
 *
 * Steam only exists in the desktop build. In a browser or the Play Store app there is no Steam to
 * connect, so the line says where the unlocks live and leaves Steam out.
 */
export const collectionStorageNote = ({
    isAchievements,
    steamConnected,
    desktop = true
}: {
    isAchievements: boolean;
    steamConnected: boolean;
    /** True in the desktop build (`hasDesktopBridge`), the only one with Steam. */
    desktop?: boolean;
}): string => {
    if (!isAchievements) {
        return 'everything here is stored on this device.';
    }
    if (!desktop) {
        return 'these are saved on this device.';
    }
    return steamConnected
        ? 'these unlock on Steam as well as on this device.'
        : 'Steam is not connected, so these stay on this device until it is.';
};
