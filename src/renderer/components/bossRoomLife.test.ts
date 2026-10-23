import { describe, expect, it } from 'vitest';
import { BOSS_EVENT_MS, bossEventDim, bossEventEnvelope, bossRoomLifeDraws, isBossRoom, realmLayerLevel } from './realmRoomLife';

describe('the boss rooms live (DGE-030)', () => {
    it('the one event rises fast and falls, and is nothing outside its time', () => {
        expect(bossEventEnvelope(Number.POSITIVE_INFINITY)).toBe(0);
        expect(bossEventEnvelope(BOSS_EVENT_MS * 0.12)).toBe(1);
        expect(bossEventEnvelope(BOSS_EVENT_MS)).toBe(0);
    });

    it('each event moves its own light, and only the Warden darkens its room', () => {
        const at = (room: 'keeper' | 'cartographer' | 'warden', family: string, since: number) => realmLayerLevel(room, family, 1000, 2, since);
        expect(at('keeper', 'lanterns', 300)).toBeGreaterThan(at('keeper', 'lanterns', Number.POSITIVE_INFINITY));
        expect(at('cartographer', 'orrery', 300)).toBeGreaterThan(at('cartographer', 'orrery', Number.POSITIVE_INFINITY));
        expect(at('warden', 'cracks', 300)).toBeGreaterThan(at('warden', 'cracks', Number.POSITIVE_INFINITY));
        expect(bossEventDim('warden', 200)).toBeLessThan(1);
        expect(bossEventDim('keeper', 200)).toBe(1);
        expect(bossEventDim('tide', 200)).toBe(1);
    });

    it("each room has its drift and mist always, and its event's draws only while it plays", () => {
        const ids = (room: 'keeper' | 'cartographer' | 'warden', since: number) => bossRoomLifeDraws({ room, t: 5000, depth: 1, lean: false, alpha: 1, sinceEvent: since }).map((draw) => draw.id);
        expect(ids('keeper', Number.POSITIVE_INFINITY).some((id) => id.startsWith('keeper-shaken'))).toBe(false);
        expect(ids('keeper', 300).some((id) => id.startsWith('keeper-shaken'))).toBe(true);
        expect(ids('cartographer', 300)).toContain('carto-sweep');
        expect(ids('warden', 300).some((id) => id.startsWith('warden-ash'))).toBe(true);
        expect(ids('warden', Number.POSITIVE_INFINITY)).toContain('warden-mist');
        expect(isBossRoom('warden')).toBe(true);
        expect(isBossRoom('tide')).toBe(false);
    });
});
