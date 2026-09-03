/**
 * What a player is told when their save could not be read, and what the way out is called.
 *
 * Worth being careful with: the player is being asked to accept losing their progress, so the
 * copy has to be honest that the old file is kept rather than deleted. Anything vaguer reads like
 * "press here to wipe your save", which nobody presses — and the alternative is playing on with
 * autosave silently off.
 */
export const SAVE_RECOVERY_COPY = {
    action: 'Start a fresh profile',
    /** Sits under the notice so the button is not the only explanation of what it does. */
    detail: 'Your old save is kept beside the new one, so it can be restored later.',
    title: 'Save could not be read'
} as const;
