import type { RealmId } from '../../shared/contracts';
import { REALM_IDS } from '../../shared/contracts';
import { resolveUiBackgroundUrl } from '../assets/ui/modeArt';
import { SCENE_SPRITES, type SceneSpriteDef } from '../assets/ui/sprites';

/**
 * One room per realm (2026-10-09), each broken into the layers that make it live, the way the
 * dungeon ring is (`scripts/scene-pipeline/realm_layers.py`, `realms.json`):
 *
 * - **base**: the painting with its lights taken out.
 * - **glows**: each of the room's lights on its own additive layer - the lava seams, the braziers,
 *   the rune ring, the ice, the shaft, the painted lightning - which the frame drives each on its
 *   own clock (`realmLayerLevel` in `realmRoomLife.ts`).
 * - **sprites**: parts of the painting set moving as loopable flipbooks - lava flowing down its
 *   seam, flames licking, water rippling, clouds billowing, vines swaying, light running up the ice -
 *   over the base (`source-over`) or added with their family's light (`lighter`).
 *
 * A realm without its painting resolves to an empty base and the room stays the dungeon ring.
 * Every layer that exists is preloaded with the run's scene art (the sprites with every scene's).
 */
export interface RealmRoomArt {
    base: string;
    /** The room's lights, by family name. */
    glows: Readonly<Record<string, string>>;
    /** The room's moving parts. */
    sprites: readonly SceneSpriteDef[];
}

const glowUrls = import.meta.glob<string>('../assets/ui/backgrounds/bg-gameplay-realm-*-v1-glow-*.webp', { eager: true, query: '?url', import: 'default' });

const glowsOf = (realm: RealmId): Record<string, string> =>
    Object.fromEntries(
        Object.entries(glowUrls).flatMap(([path, url]) => {
            const family = new RegExp(`/bg-gameplay-realm-${realm}-v1-glow-([a-z]+)\\.webp$`).exec(path)?.[1];
            return family ? [[family, url]] : [];
        })
    );

const REALM_SPRITES: Readonly<Record<RealmId, readonly SceneSpriteDef[]>> = {
    frost: SCENE_SPRITES.realmFrost.sprites,
    ember: SCENE_SPRITES.realmEmber.sprites,
    tide: SCENE_SPRITES.realmTide.sprites,
    storm: SCENE_SPRITES.realmStorm.sprites,
    grove: SCENE_SPRITES.realmGrove.sprites
};

export const REALM_ROOM_ART: Readonly<Record<RealmId, RealmRoomArt>> = Object.fromEntries(
    REALM_IDS.map((realm) => [realm, {
        base: resolveUiBackgroundUrl(`bg-gameplay-realm-${realm}-v1-base.webp`, ''),
        glows: glowsOf(realm),
        sprites: REALM_SPRITES[realm]
    }])
) as Record<RealmId, RealmRoomArt>;

/** The realm whose own room a floor opens in, or null while its painting is not there. */
export const realmRoomFor = (realm: RealmId | null | undefined, art: Readonly<Record<RealmId, RealmRoomArt>> = REALM_ROOM_ART): RealmId | null =>
    realm && art[realm]?.base ? realm : null;

/** Every realm room layer that exists, for the run preloader (the sprites go with every scene's). */
export const getRealmRoomArtUrls = (art: Readonly<Record<RealmId, RealmRoomArt>> = REALM_ROOM_ART): string[] =>
    REALM_IDS.flatMap((realm) => (art[realm].base ? [art[realm].base, ...Object.values(art[realm].glows)] : [])).filter(Boolean);
