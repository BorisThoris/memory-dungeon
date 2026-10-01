import { create } from 'zustand/react';
import type { RealmId, RealmSeverity } from '../../shared/contracts';

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
