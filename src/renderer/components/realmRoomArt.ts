import type { RealmId } from '../../shared/contracts';
import { REALM_IDS } from '../../shared/contracts';
import { resolveUiBackgroundUrl } from '../assets/ui/modeArt';

/**
 * One room per realm (2026-10-09). A realm used to be the dungeon ring recoloured with weather on
 * it; the plan is a painted room for each, made the way the dungeon ring was: a Z-Image plate at
 * the ring's size and camera (`scripts/card-pipeline/scene-moods.zimage.manifest.json`, the
 * `bg-gameplay-realm-*` entries), cut into a dark base and an additive glow by
 * `scripts/scene-pipeline/` so the room can be lit.
 *
 * These are the slots. A realm whose painting is not in `assets/ui/backgrounds/` yet resolves to
 * '' and the room stays the dungeon ring, graded, as before; once its base is there, a floor in
 * that realm opens in it (`sceneMood.ts` picks the `realm` plate), its glow rises with the combo,
 * and the realm's weather plays on it. Every slot that resolves is preloaded with the run's other
 * scene art, so nothing streams in play.
 */
export interface RealmRoomArt {
    base: string;
    glow: string;
}

export const REALM_ROOM_ART: Readonly<Record<RealmId, RealmRoomArt>> = Object.fromEntries(
    REALM_IDS.map((realm) => [realm, {
        base: resolveUiBackgroundUrl(`bg-gameplay-realm-${realm}-v1-base.webp`, ''),
        glow: resolveUiBackgroundUrl(`bg-gameplay-realm-${realm}-v1-glow.webp`, '')
    }])
) as Record<RealmId, RealmRoomArt>;

/** The realm whose own room a floor opens in, or null while its painting is not there. */
export const realmRoomFor = (realm: RealmId | null | undefined, art: Readonly<Record<RealmId, RealmRoomArt>> = REALM_ROOM_ART): RealmId | null =>
    realm && art[realm]?.base ? realm : null;

/** Every realm room layer that exists, for the run preloader. */
export const getRealmRoomArtUrls = (art: Readonly<Record<RealmId, RealmRoomArt>> = REALM_ROOM_ART): string[] =>
    REALM_IDS.flatMap((realm) => [art[realm].base, art[realm].glow]).filter(Boolean);
