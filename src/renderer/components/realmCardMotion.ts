import type { RealmEvent, RealmId } from '../../shared/contracts';

/**
 * The realm in the cards' bodies (2026-10-01). `RealmAmbientBackPlane` paints the realm on every
 * face-down card and `tileCellGlide` flies the cards the weather moves, but a card the weather only
 * touched (frozen, set alight, vined, struck) sat as still as one it never reached. Two motions:
 *
 * - **Sway**, all the time, on every face-down card: the tide bobs them like boats, the grove sways
 *   them in a wind that rolls across the board, the ember shimmers them in heat, the storm makes
 *   them tremble in fits, the frost shivers them now and then.
 * - **Jolt**, once, on the cards an event names: lightning kicks them with a crack of jitter, fire
 *   hops them, a gust leans them over, a current rolls them, vines drag them down.
 *
 * Depth and rotation only, never x or y: the board picks cards where they are drawn, and a card
 * that wandered sideways would move out from under a press.
 */

/** How each event moves the cards it names. */
export type RealmJoltFamily = 'flash' | 'flare' | 'gust' | 'surge' | 'creep' | 'pop';

export const REALM_JOLT_FAMILY: Readonly<Record<RealmEvent['kind'], RealmJoltFamily>> = {
    lightning: 'flash',
    thunderclap: 'flash',
    reaction: 'flash',
    wildfire: 'flare',
    firestorm: 'flare',
    burnout: 'flare',
    blizzard: 'gust',
    whiteout: 'gust',
    frostbite: 'gust',
    current: 'surge',
    springtide: 'surge',
    overgrowth: 'creep',
    bloom: 'creep',
    harvest: 'pop',
    thaw: 'pop',
    doused: 'pop',
    scald: 'flare',
    undertow: 'surge',
    static: 'flash',
    snare: 'creep'
};

/** How long a jolt lasts. */
export const REALM_JOLT_MS = 900;

export interface RealmCardOffset {
    /** Toward the camera. */
    z: number;
    rotX: number;
    rotY: number;
    rotZ: number;
}

export const ZERO_REALM_OFFSET: RealmCardOffset = { z: 0, rotX: 0, rotY: 0, rotZ: 0 };

/** A cheap smooth noise in -1..1, so the storm's tremble is not a tone. */
const wobble = (t: number, phase: number): number =>
    Math.sin(t * 23.1 + phase) * 0.55 + Math.sin(t * 37.7 + phase * 1.7) * 0.3 + Math.sin(t * 61.3 + phase * 2.3) * 0.15;

/**
 * The realm's sway for one face-down card. `seconds` is the clock, `phase` the card's own (its
 * layout seed), `column`/`row` its place, so the grove's wind can roll across the board.
 */
export const sampleRealmSway = (
    realm: RealmId | null,
    strength: number,
    seconds: number,
    phase: number,
    column: number,
    row: number
): RealmCardOffset => {
    if (!realm || strength <= 0) return ZERO_REALM_OFFSET;
    const s = strength;
    switch (realm) {
        case 'tide': {
            // Boats at anchor: a slow bob, and a roll a little behind it.
            const t = seconds * 1.25 + phase;
            return { z: 0.055 * s * Math.sin(t), rotX: 0.05 * s * Math.sin(t - 0.9), rotY: 0, rotZ: 0.035 * s * Math.sin(t * 0.8 + 1.3) };
        }
        case 'grove': {
            // A wind rolling across the board from the left: each column a beat behind the last.
            const t = seconds * 0.9 - column * 0.55 - row * 0.2;
            return { z: 0, rotX: 0.012 * s * Math.sin(t * 1.7 + phase), rotY: 0, rotZ: 0.05 * s * Math.sin(t) };
        }
        case 'ember': {
            // Heat shimmer: quick and shallow.
            const t = seconds * 3.4 + phase;
            return { z: 0.028 * s * Math.sin(t), rotX: 0.018 * s * Math.sin(t * 1.3 + 0.7), rotY: 0, rotZ: 0.01 * s * Math.sin(t * 0.7) };
        }
        case 'storm': {
            // Trembling in fits: most of the time still, then a burst as the charge builds.
            const fit = Math.max(0, Math.sin(seconds * 0.85 + phase) - 0.72) / 0.28;
            return { z: 0.02 * s * fit * wobble(seconds, phase), rotX: 0, rotY: 0, rotZ: 0.035 * s * fit * wobble(seconds, phase + 4) };
        }
        case 'frost': {
            // Stiff with cold, and a shiver every so often.
            const fit = Math.max(0, Math.sin(seconds * 0.5 + phase) - 0.9) / 0.1;
            return { z: 0, rotX: 0, rotY: 0, rotZ: 0.022 * s * fit * Math.sin(seconds * 41 + phase) };
        }
    }
    return ZERO_REALM_OFFSET;
};

/** The jolt an event gives one of the cards it names, `ms` after it landed. Zero once it is over. */
export const sampleRealmJolt = (family: RealmJoltFamily, ms: number, phase: number): RealmCardOffset => {
    if (ms < 0 || ms >= REALM_JOLT_MS) return ZERO_REALM_OFFSET;
    const t = ms / REALM_JOLT_MS;
    const decay = (1 - t) * (1 - t);
    const seconds = ms / 1000;
    switch (family) {
        case 'flash':
            // A crack: thrown at the camera, then rattling.
            return {
                z: 0.45 * Math.exp(-ms / 110),
                rotX: 0.12 * decay * wobble(seconds, phase),
                rotY: 0.1 * decay * wobble(seconds, phase + 2),
                rotZ: 0.22 * decay * wobble(seconds, phase + 5)
            };
        case 'flare': {
            // Caught alight: a hop, and a quick flicker as it lands.
            const hop = Math.sin(Math.PI * Math.min(1, t * 2.2));
            return { z: 0.38 * hop, rotX: -0.12 * hop, rotY: 0, rotZ: 0.06 * decay * Math.sin(seconds * 30 + phase) };
        }
        case 'gust':
            // Leaned over by the wind and springing back.
            return { z: 0.08 * decay, rotX: 0, rotY: 0.32 * decay * Math.cos(seconds * 9), rotZ: -0.16 * decay * Math.cos(seconds * 9) };
        case 'surge':
            // Rolled by a wave passing under it.
            return { z: 0.22 * Math.sin(Math.PI * t) * decay, rotX: 0.4 * decay * Math.sin(seconds * 11 + phase * 0.2), rotY: 0, rotZ: 0 };
        case 'creep':
            // Dragged down by the vines, shuddering.
            return { z: -0.18 * Math.sin(Math.PI * Math.min(1, t * 1.6)), rotX: 0.1 * decay, rotY: 0, rotZ: 0.07 * decay * Math.sin(seconds * 26 + phase) };
        case 'pop':
            // Freed: a small lift.
            return { z: 0.32 * Math.sin(Math.PI * t) * decay, rotX: -0.08 * Math.sin(Math.PI * t) * decay, rotY: 0, rotZ: 0 };
    }
    return ZERO_REALM_OFFSET;
};

/** How a glide flies for a card the weather moved: lightning snaps, a gust skims, a current rolls. */
export interface RealmGlideShape {
    ms: number;
    arc: number;
    tilt: number;
}

export const REALM_GLIDE_SHAPE: Readonly<Partial<Record<RealmJoltFamily, RealmGlideShape>>> = {
    flash: { ms: 260, arc: 0.25, tilt: 0.35 },
    gust: { ms: 520, arc: 0.3, tilt: 0.4 },
    surge: { ms: 820, arc: 0.6, tilt: 0.1 }
};

const memory = new WeakMap<object, RealmCardOffset>();

/**
 * Take back what was added to `card` last frame. Called before the frame's damping, so the damping
 * works from where the card would be without the realm and the offset never compounds.
 */
export const takeBackRealmOffset = (card: { position: { z: number }; rotation: { x: number; y: number; z: number } }): void => {
    const last = memory.get(card);
    if (!last) return;
    card.position.z -= last.z;
    card.rotation.x -= last.rotX;
    card.rotation.y -= last.rotY;
    card.rotation.z -= last.rotZ;
    memory.delete(card);
};

/** Add this frame's offset to `card` and remember it for `takeBackRealmOffset`. */
export const putRealmOffset = (
    card: { position: { z: number }; rotation: { x: number; y: number; z: number } },
    offset: RealmCardOffset
): void => {
    if (offset.z === 0 && offset.rotX === 0 && offset.rotY === 0 && offset.rotZ === 0) return;
    card.position.z += offset.z;
    card.rotation.x += offset.rotX;
    card.rotation.y += offset.rotY;
    card.rotation.z += offset.rotZ;
    memory.set(card, offset);
};

export const addRealmOffsets = (a: RealmCardOffset, b: RealmCardOffset): RealmCardOffset =>
    b === ZERO_REALM_OFFSET ? a : a === ZERO_REALM_OFFSET ? b : { z: a.z + b.z, rotX: a.rotX + b.rotX, rotY: a.rotY + b.rotY, rotZ: a.rotZ + b.rotZ };
