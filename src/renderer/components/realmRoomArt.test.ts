import { describe, expect, it } from 'vitest';
import { REALM_IDS, type RealmId } from '../../shared/contracts';
import { COMBO_HEAT_THEMES } from '../../shared/combo-heat-rules';
import { getRealmRoomArtUrls, realmRoomFor, type RealmRoomArt } from './realmRoomArt';
import { deriveSceneMood } from './sceneMood';

const theme = (id: string) => COMBO_HEAT_THEMES.find((candidate) => candidate.id === id)!;
const art = (painted: RealmId[]): Record<RealmId, RealmRoomArt> =>
    Object.fromEntries(REALM_IDS.map((realm) => [realm, painted.includes(realm) ? { base: `${realm}-base.webp`, glow: `${realm}-glow.webp` } : { base: '', glow: '' }])) as Record<RealmId, RealmRoomArt>;
const run = (realmId: RealmId) => ({ status: 'playing', board: { level: 4 }, realmId }) as never;

describe('a room for every realm', () => {
    it('opens a realm floor in its own room once its painting exists, and in the dungeon ring until then', () => {
        const tideOnly = art(['tide']);
        expect(realmRoomFor('tide', tideOnly)).toBe('tide');
        expect(realmRoomFor('frost', tideOnly)).toBeNull();
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('tide'), storeOpen: false, temper: theme('ember'), realmRoomArt: tideOnly })).toMatchObject({ plate: 'realm', realmRoom: 'tide' });
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('frost'), storeOpen: false, temper: theme('ember'), realmRoomArt: tideOnly })).toMatchObject({ plate: 'dungeon', realmRoom: null });
    });

    it('still gives the room over to the store', () => {
        expect(deriveSceneMood({ combo: 0, latestLoss: null, run: run('tide'), storeOpen: true, temper: theme('ember'), realmRoomArt: art(['tide']) }).plate).toBe('shop');
    });

    it('preloads every painted layer and nothing that is not there', () => {
        expect(getRealmRoomArtUrls(art(['tide', 'grove']))).toEqual(['tide-base.webp', 'tide-glow.webp', 'grove-base.webp', 'grove-glow.webp']);
        expect(getRealmRoomArtUrls(art([]))).toEqual([]);
    });
});
