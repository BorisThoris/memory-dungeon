import type { BoardState, RealmId } from '../../shared/contracts';
import { REALM_IDS } from '../../shared/contracts';
import { isCartographerFloor } from '../../shared/cartographer-rules';
import { isKeeperFloor } from '../../shared/keeper-rules';
import { isWardenFloor } from '../../shared/warden-rules';
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
/**
 * The act bosses' own rooms (DGE-030, 2026-10-22): the Keeper of Halls' Hall of Doors, the
 * Cartographer's Map Room, the Warden's Sealed Gate. Painted and cut by the realm rooms' pipeline,
 * in the same namespace (`bg-gameplay-realm-<room>-v1`), and shown on the boss's own floor in place
 * of the realm's room - the realm's weather still strikes over it (`gameplaySceneFrame.ts`).
 */
export const BOSS_ROOM_IDS = ['keeper', 'cartographer', 'warden'] as const;
export type BossRoomId = (typeof BOSS_ROOM_IDS)[number];
/** A room the scene can open in: a realm's, or an act boss's. */
export type SceneRoomId = RealmId | BossRoomId;
const SCENE_ROOM_IDS: readonly SceneRoomId[] = [...REALM_IDS, ...BOSS_ROOM_IDS];

export interface RealmRoomArt {
    base: string;
    /** The room's lights, by family name. */
    glows: Readonly<Record<string, string>>;
    /** The room's moving parts. */
    sprites: readonly SceneSpriteDef[];
}

const glowUrls = import.meta.glob<string>('../assets/ui/backgrounds/bg-gameplay-realm-*-v1-glow-*.webp', { eager: true, query: '?url', import: 'default' });

const glowsOf = (realm: SceneRoomId): Record<string, string> =>
    Object.fromEntries(
        Object.entries(glowUrls).flatMap(([path, url]) => {
            const family = new RegExp(`/bg-gameplay-realm-${realm}-v1-glow-([a-z]+)\\.webp$`).exec(path)?.[1];
            return family ? [[family, url]] : [];
        })
    );

// The boss rooms move by their lights, their live warps and their one event; their flipbook manifests are empty.
const REALM_SPRITES: Readonly<Record<SceneRoomId, readonly SceneSpriteDef[]>> = {
    keeper: SCENE_SPRITES.realmKeeper.sprites,
    cartographer: SCENE_SPRITES.realmCartographer.sprites,
    warden: SCENE_SPRITES.realmWarden.sprites,
    frost: SCENE_SPRITES.realmFrost.sprites,
    ember: SCENE_SPRITES.realmEmber.sprites,
    tide: SCENE_SPRITES.realmTide.sprites,
    storm: SCENE_SPRITES.realmStorm.sprites,
    grove: SCENE_SPRITES.realmGrove.sprites
};

export const REALM_ROOM_ART: Readonly<Record<SceneRoomId, RealmRoomArt>> = Object.fromEntries(
    SCENE_ROOM_IDS.map((realm) => [realm, {
        base: resolveUiBackgroundUrl(`bg-gameplay-realm-${realm}-v1-base.webp`, ''),
        glows: glowsOf(realm),
        sprites: REALM_SPRITES[realm]
    }])
) as Record<SceneRoomId, RealmRoomArt>;

/** The realm whose own room a floor opens in, or null while its painting is not there. */
export const realmRoomFor = (realm: RealmId | null | undefined, art: Readonly<Record<SceneRoomId, RealmRoomArt>> = REALM_ROOM_ART): RealmId | null =>
    realm && art[realm]?.base ? realm : null;

/**
 * One room's full-plate layers - its painting and its lights - for the scene to decode before it
 * crossfades in (`SceneCanvas`'s `prime`). The sprites are drawn small and decode cheaply where they land.
 */
export const realmRoomPlateUrls = (realm: SceneRoomId, art: Readonly<Record<SceneRoomId, RealmRoomArt>> = REALM_ROOM_ART): string[] => {
    const room = art[realm];
    return room?.base ? [room.base, ...Object.values(room.glows)] : [];
};

/** Every realm room layer that exists, for the run preloader (the sprites go with every scene's). */
export const getRealmRoomArtUrls = (art: Readonly<Record<SceneRoomId, RealmRoomArt>> = REALM_ROOM_ART): string[] =>
    SCENE_ROOM_IDS.flatMap((realm) => (art[realm].base ? [art[realm].base, ...Object.values(art[realm].glows)] : [])).filter(Boolean);

/** The act boss whose room a floor opens in (by its archetype, so Endless and the test pace find it too), or null while its painting is not there. */
export const bossRoomFor = (
    board: Pick<BoardState, 'floorArchetypeId'> | null | undefined,
    art: Readonly<Record<SceneRoomId, RealmRoomArt>> = REALM_ROOM_ART
): BossRoomId | null => {
    const boss: BossRoomId | null = isKeeperFloor(board) ? 'keeper' : isCartographerFloor(board) ? 'cartographer' : isWardenFloor(board) ? 'warden' : null;
    return boss && art[boss]?.base ? boss : null;
};

/** The boss room an act ends in, for the warm-up before its door. */
export const BOSS_ROOM_BY_ACT: Readonly<Record<string, BossRoomId>> = { living_dungeon: 'keeper', deep: 'cartographer', abyss: 'warden' };
