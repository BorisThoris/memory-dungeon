/**
 * The glide: a card that changes cells flies there instead of appearing there.
 *
 * Until 2026-10-01 a card's position outside the shuffle and entrance windows was assigned
 * straight from its cell, so everything that moves a card - the tide's current, the blizzard's row,
 * lightning's swap, the restless floor, the skittish flinch, the magpie, a swap or a shuffle, the
 * void's reshuffle - happened between two frames and read as nothing at all. Now, whenever a
 * card's target jumps by more than a fraction of a cell, the card lifts off where it was, arcs to
 * the new cell over `GLIDE_MS`, tilting and swelling a little in the air, and lands. It follows the
 * live target the whole way, so hover, shake and lift still apply on top.
 *
 * Kept per card in a WeakMap keyed by the Three group, so nothing about the card's React state
 * changes and a card that unmounts takes its glide with it.
 */
export const GLIDE_MS = 650;
/** A target jump this far (world units, a cell is ~1.18) is a move, not hover or shake. */
export const GLIDE_JUMP = 0.45;
/** How high a gliding card lifts toward the camera at mid-flight. */
export const GLIDE_ARC = 0.9;
/** The tilt and the swell at mid-flight. */
export const GLIDE_TILT = 0.22;
export const GLIDE_SWELL = 0.1;

interface GlideMemory {
    lastX: number;
    lastY: number;
    glide: { fromX: number; fromY: number; fromZ: number; start: number; tiltSign: number } | null;
}

const memory = new WeakMap<object, GlideMemory>();

const easeInOut = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export interface GlideFrame {
    x: number;
    y: number;
    /** Added to the target's z (toward the camera). */
    lift: number;
    /** Added to the card's rotation about z. */
    tilt: number;
    /** Multiplies the card's scale. */
    swell: number;
}

/**
 * Where a card should be this frame. Returns null when it is not gliding (the caller sets the
 * target as before). `current` is the card's displayed position, where a new glide starts from.
 */
export const sampleCellGlide = (
    card: object,
    target: { x: number; y: number; z: number },
    current: { x: number; y: number; z: number },
    now: number,
    reduceMotion: boolean
): GlideFrame | null => {
    let entry = memory.get(card);
    if (!entry) {
        entry = { lastX: target.x, lastY: target.y, glide: null };
        memory.set(card, entry);
        return null;
    }
    const jumped = Math.hypot(target.x - entry.lastX, target.y - entry.lastY) > GLIDE_JUMP;
    entry.lastX = target.x;
    entry.lastY = target.y;
    if (jumped && !reduceMotion) {
        entry.glide = { fromX: current.x, fromY: current.y, fromZ: current.z, start: now, tiltSign: target.x >= current.x ? -1 : 1 };
    }
    const glide = entry.glide;
    if (!glide) return null;
    const t = (now - glide.start) / GLIDE_MS;
    if (t >= 1 || t < 0) {
        entry.glide = null;
        return null;
    }
    const eased = easeInOut(t);
    const arc = Math.sin(Math.PI * t);
    return {
        x: glide.fromX + (target.x - glide.fromX) * eased,
        y: glide.fromY + (target.y - glide.fromY) * eased,
        lift: GLIDE_ARC * arc,
        tilt: glide.tiltSign * GLIDE_TILT * arc,
        swell: 1 + GLIDE_SWELL * arc
    };
};

/** Whether any card is mid-glide (for tests and the frame loop's "keep rendering" check). */
export const isCardGliding = (card: object): boolean => memory.get(card)?.glide != null;
