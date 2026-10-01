import type { RealmId, Tile } from '../../shared/contracts';
import type { RealmJoltFamily } from './realmCardMotion';

/**
 * The realm in the board's own particles (2026-10-01). The cards wore the realm and moved with
 * it, but the air between them was the combo's alone. Now the weather is in the air too, through
 * the board's pooled particle system (free slots only, like the combo's embers, so it can never
 * crowd out a match or a bomb):
 *
 * - **status**: a burning card throws sparks up, a frozen or snowed card sheds frost motes, a vined
 *   card drops leaves, a card lightning lit crackles;
 * - **ambient**: a few face-down cards a tick give off the realm itself: embers rising in the
 *   Cinder Deep, drops falling in the Drowned Vault, snow in the Frozen Reach, static in the
 *   Thunder Spire, leaves in the Overgrown Crypt;
 * - **event**: every realm event bursts on the cards it names, in its family's colour and motion.
 */

export type RealmMoteMode = 'rise' | 'fall' | 'spark';

export interface RealmMote {
    tint: string;
    mode: RealmMoteMode;
    energy: number;
    /** Against the combo's sparks; omitted is the realm default (`REALM_MOTE_SIZE`). */
    size?: number;
}

/** Realm motes are bigger than the combo's sparks: snow, drops and leaves read at arm's length. */
export const REALM_MOTE_SIZE = 2.4;

export const REALM_AMBIENT_MOTE: Readonly<Record<RealmId, RealmMote>> = {
    ember: { tint: '#ff9a3c', mode: 'rise', energy: 0.45 },
    tide: { tint: '#8fd0ff', mode: 'fall', energy: 0.35 },
    frost: { tint: '#e6f6ff', mode: 'fall', energy: 0.3 },
    storm: { tint: '#c9a8ff', mode: 'spark', energy: 0.4 },
    grove: { tint: '#8fd86a', mode: 'fall', energy: 0.25 }
};

export const REALM_EVENT_MOTE: Readonly<Record<RealmJoltFamily, RealmMote>> = {
    flash: { tint: '#ece4ff', mode: 'spark', energy: 1, size: 1.6 },
    flare: { tint: '#ff7a1a', mode: 'rise', energy: 1 },
    gust: { tint: '#f4fbff', mode: 'fall', energy: 1 },
    surge: { tint: '#7cc8ff', mode: 'spark', energy: 0.8 },
    creep: { tint: '#5fbf3f', mode: 'fall', energy: 0.9 },
    pop: { tint: '#fff2b0', mode: 'rise', energy: 0.8 }
};

/** What a card's own realm status gives off, if anything: fire over ice over snow over vines. */
export const realmStatusMote = (tile: Pick<Tile, 'state' | 'fuse' | 'frost' | 'snowed' | 'vined'>, lit: boolean): RealmMote | null => {
    if (tile.state !== 'hidden') return null;
    if (tile.fuse != null) return { tint: '#ff7a1a', mode: 'rise', energy: tile.fuse <= 1 ? 1 : 0.65 };
    if ((tile.frost ?? 0) > 0) return { tint: '#d8f2ff', mode: 'fall', energy: 0.45 };
    if (tile.snowed) return { tint: '#ffffff', mode: 'fall', energy: 0.25 };
    if (tile.vined) return { tint: '#6fcf4a', mode: 'fall', energy: 0.3 };
    if (lit) return { tint: '#d9c8ff', mode: 'spark', energy: 0.5 };
    return null;
};

/** Seconds between realm particle ticks, by graphics quality. */
export const realmMoteInterval = (quality: 'low' | 'medium' | 'high'): number => (quality === 'low' ? 0.5 : quality === 'medium' ? 0.3 : 0.18);
