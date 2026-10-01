import { create } from 'zustand/react';
import type { RealmEvent, RealmId, RealmSeverity, TileSuit } from '../../shared/contracts';
import { REALM_JOLT_FAMILY, REALM_JOLT_MS, type RealmJoltFamily } from './realmCardMotion';

/**
 * Which realm the board is in, for the cards themselves (`RealmAmbientBackPlane`). The game screen
 * sets it; every card reads it. A tiny store rather than a prop threaded through the board's four
 * layers, and it reaches inside the 3D canvas because it is an external store, not React context.
 */
export interface RealmAmbience {
    realm: RealmId | null;
    secondary: RealmId | null;
    /** How hard the realm shows on the cards, 0..1: calm, wild, raging. */
    strength: number;
}

/** The realm's last event, for the cards it names to jolt (`realmCardMotion.ts`). */
export interface RealmAmbienceEvent {
    key: string;
    family: RealmJoltFamily;
    tileIds: ReadonlySet<string>;
    /** `performance.now()` when it reached the screen. */
    at: number;
}

/** The sway (`realm-sway-rules.ts`): the suit leaning the world, the realm it leans toward, and how far (0..1). */
export interface RealmSwayLean {
    suit: TileSuit;
    realm: RealmId;
    progress: number;
}

export const useRealmSwayLean = create<{ lean: RealmSwayLean | null }>(() => ({ lean: null }));

export const setRealmSwayLean = (lean: RealmSwayLean | null): void => {
    const now = useRealmSwayLean.getState().lean;
    if (now?.suit === lean?.suit && now?.realm === lean?.realm && now?.progress === lean?.progress) return;
    useRealmSwayLean.setState({ lean });
};

export const useRealmEventPulse = create<{ event: RealmAmbienceEvent | null }>(() => ({ event: null }));

/**
 * Whether a card needs a frame for the realm: a face-down card sways while a realm holds the board
 * (not at low graphics), and a card an event names jolts until the jolt is over. The board skips
 * idle cards, so without this the realm would stop at the first still frame.
 */
export const realmCardWantsFrame = (tileId: string, swaying: boolean, nowMs: number): boolean => {
    if (swaying) {
        const ambience = useRealmAmbience.getState();
        if (ambience.realm && ambience.strength > 0) return true;
    }
    const event = useRealmEventPulse.getState().event;
    return event != null && event.tileIds.has(tileId) && nowMs - event.at < REALM_JOLT_MS + 50;
};

/** Announce a realm event to the cards; the same key twice is one event. */
export const pulseRealmEvent = (event: Pick<RealmEvent, 'key' | 'kind' | 'tileIds'> | null): void => {
    const now = useRealmEventPulse.getState().event;
    if (!event) {
        if (now) useRealmEventPulse.setState({ event: null });
        return;
    }
    if (now?.key === event.key) return;
    useRealmEventPulse.setState({
        event: { key: event.key, family: REALM_JOLT_FAMILY[event.kind] ?? 'pop', tileIds: new Set(event.tileIds), at: performance.now() }
    });
};

export const REALM_AMBIENCE_STRENGTH: Readonly<Record<RealmSeverity, number>> = {
    calm: 0.6,
    wild: 0.8,
    raging: 1
};

export const useRealmAmbience = create<RealmAmbience>(() => ({ realm: null, secondary: null, strength: 0 }));

export const setRealmAmbience = (next: RealmAmbience): void => {
    const now = useRealmAmbience.getState();
    if (now.realm === next.realm && now.secondary === next.secondary && now.strength === next.strength) return;
    useRealmAmbience.setState(next);
};
