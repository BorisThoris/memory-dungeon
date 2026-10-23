import { describe, expect, it } from 'vitest';
import { REALM_IDS, type RealmId } from '../../shared/contracts';
import { COMBO_HEAT_THEMES } from '../../shared/combo-heat-rules';
import { BOSS_ROOM_IDS, bossRoomFor, getRealmRoomArtUrls, realmRoomFor, type RealmRoomArt, type SceneRoomId } from './realmRoomArt';
import { deriveSceneMood } from './sceneMood';

const theme = (id: string) => COMBO_HEAT_THEMES.find((candidate) => candidate.id === id)!;
const art = (painted: SceneRoomId[]): Record<SceneRoomId, RealmRoomArt> =>
    Object.fromEntries([...REALM_IDS, ...BOSS_ROOM_IDS].map((realm) => [realm, painted.includes(realm) ? { base: `${realm}-base.webp`, glows: { ring: `${realm}-glow-ring.webp` }, sprites: [] } : { base: '', glows: {}, sprites: [] }])) as unknown as Record<SceneRoomId, RealmRoomArt>;
const run = (realmId: RealmId) => ({ status: 'playing', board: { level: 4 }, realmId }) as never;

describe('a room for every realm', () => {
    it('opens a realm floor in its own room once its painting exists, and in the dungeon ring until then', () => {
        const tideOnly = art(['tide']);
        expect(realmRoomFor('tide', tideOnly)).toBe('tide');
        expect(realmRoomFor('frost', tideOnly)).toBeNull();
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('tide'), storeOpen: false, temper: theme('ember'), realmRoomArt: tideOnly })).toMatchObject({ plate: 'realm', realmRoom: 'tide' });
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('frost'), storeOpen: false, temper: theme('ember'), realmRoomArt: tideOnly })).toMatchObject({ plate: 'dungeon', realmRoom: null });
    });

    it("opens an act boss floor in the boss room, with the realm's weather still over it, and its event keyed per event", () => {
        const painted = art(['tide', 'keeper', 'warden']);
        const keeperFloor = { status: 'playing', board: { level: 24, floorArchetypeId: 'keeper_hall' }, realmId: 'tide', keeperSwapsThisFloor: 2 } as never;
        expect(bossRoomFor({ floorArchetypeId: 'keeper_hall' }, painted)).toBe('keeper');
        expect(bossRoomFor({ floorArchetypeId: 'cartographer_hall' }, painted)).toBeNull();
        expect(bossRoomFor({ floorArchetypeId: 'warden_hall' }, painted)).toBe('warden');
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: keeperFloor, storeOpen: false, temper: theme('ember'), realmRoomArt: painted })).toMatchObject({
            plate: 'realm', realmRoom: 'keeper', weatherRealm: 'tide', bossEventKey: 'keeper:24:2'
        });
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('tide'), storeOpen: false, temper: theme('ember'), realmRoomArt: painted })).toMatchObject({ realmRoom: 'tide', bossEventKey: null });
    });

    it('still gives the room over to the store', () => {
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('tide'), storeOpen: true, temper: theme('ember'), realmRoomArt: art(['tide']) }).plate).toBe('shop');
    });

    it('preloads every painted layer and nothing that is not there', () => {
        expect(getRealmRoomArtUrls(art(['tide', 'grove']))).toEqual(['tide-base.webp', 'tide-glow-ring.webp', 'grove-base.webp', 'grove-glow-ring.webp']);
        expect(getRealmRoomArtUrls(art([]))).toEqual([]);
    });
});
