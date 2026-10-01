import { describe, expect, it } from 'vitest';
import { REALM_IDS } from '../../shared/contracts';
import { REALM_JOLT_FAMILY } from './realmCardMotion';
import { REALM_AMBIENT_MOTE, REALM_EVENT_MOTE, realmMoteInterval, realmStatusMote } from './realmParticles';

describe('the realm in the air', () => {
    it('gives every realm an ambient mote and every event family a burst', () => {
        for (const realm of REALM_IDS) expect(REALM_AMBIENT_MOTE[realm], realm).toBeDefined();
        for (const family of new Set(Object.values(REALM_JOLT_FAMILY))) expect(REALM_EVENT_MOTE[family], family).toBeDefined();
    });

    it('reads a face-down card’s status: fire first, then ice, snow, vines', () => {
        expect(realmStatusMote({ state: 'hidden', fuse: 1, frost: 2 }, false)?.mode).toBe('rise');
        expect(realmStatusMote({ state: 'hidden', fuse: 1 }, false)?.energy).toBe(1);
        expect(realmStatusMote({ state: 'hidden', frost: 2, vined: true }, false)?.tint).toBe('#d8f2ff');
        expect(realmStatusMote({ state: 'hidden', snowed: true }, false)?.mode).toBe('fall');
        expect(realmStatusMote({ state: 'hidden', vined: true }, false)?.tint).toBe('#6fcf4a');
        expect(realmStatusMote({ state: 'hidden' }, true)?.mode).toBe('spark');
        expect(realmStatusMote({ state: 'hidden' }, false)).toBeNull();
        expect(realmStatusMote({ state: 'matched', fuse: 1 }, false)).toBeNull();
    });

    it('ticks slower on lower graphics', () => {
        expect(realmMoteInterval('low')).toBeGreaterThan(realmMoteInterval('medium'));
        expect(realmMoteInterval('medium')).toBeGreaterThan(realmMoteInterval('high'));
    });
});
