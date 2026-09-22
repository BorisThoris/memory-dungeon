/**
 * How close the memorize window is to closing, as something the interface can lean on.
 *
 * Memorizing is the one stretch of a memory game where the player is doing the actual work, and it
 * was the flattest thing in the run: a gold bar crossing at a constant rate and a number counting
 * down in the same colour at one second as at ten. Nothing said *look now*. The bar already carried
 * the fact — it is most of the way across — but a fact read at a glance, in an unchanged colour,
 * is a fact a player absorbed ten seconds ago and stopped rereading.
 *
 * Nothing but the HUD is allowed to answer this. The obvious move is to have the room close in as
 * the window shuts, and it is the wrong one: the player's whole task right now is *seeing the
 * board*, and dimming or crowding the stage at the exact moment they most need to look at it would
 * be taking the game away to tell them the game is about to be taken away.
 */
export interface MemorizeUrgency {
    /** 0 for most of the window, rising to 1 as it closes. */
    level: number;
    /** The last moments: worth the bar's colour and the count's weight, not just a nudge. */
    closing: boolean;
}

const clamp01 = (value: number): number => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0);

/**
 * Where the window stops being long and starts being short. Deliberately late: a countdown that
 * looks urgent for half its length is a countdown that is never urgent, and the early part of
 * memorizing is when a player wants to be left alone to look.
 */
export const MEMORIZE_URGENT_FROM = 0.68;

/** Past this the window is genuinely closing, and the HUD says so in the colour it uses for loss. */
export const MEMORIZE_CLOSING_FROM = 0.86;

export const memorizeUrgency = (progress: number): MemorizeUrgency => {
    const p = clamp01(progress);
    const span = 1 - MEMORIZE_URGENT_FROM;
    const raw = clamp01((p - MEMORIZE_URGENT_FROM) / span);
    // Ease in: the first part of the urgent stretch barely registers and the last of it is all of
    // it, so the rise reads as the window accelerating shut rather than as a second linear bar.
    return {
        level: Math.round(raw * raw * 1000) / 1000,
        closing: p >= MEMORIZE_CLOSING_FROM
    };
};
