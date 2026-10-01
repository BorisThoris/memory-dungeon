import { describe, expect, it } from 'vitest';
import {
    REALM_GLIDE_SHAPE,
    REALM_JOLT_FAMILY,
    REALM_JOLT_MS,
    ZERO_REALM_OFFSET,
    putRealmOffset,
    sampleRealmJolt,
    sampleRealmSway,
    takeBackRealmOffset
} from './realmCardMotion';

const card = () => ({ position: { x: 1, y: 2, z: 0.5 }, rotation: { x: 0.1, y: Math.PI, z: -0.05 } });

describe('realm card motion', () => {
    it('sways nothing without a realm, and something in every realm', () => {
        expect(sampleRealmSway(null, 1, 3, 0.4, 1, 1)).toBe(ZERO_REALM_OFFSET);
        expect(sampleRealmSway('tide', 0, 3, 0.4, 1, 1)).toBe(ZERO_REALM_OFFSET);
        for (const realm of ['tide', 'grove', 'ember', 'storm', 'frost'] as const) {
            const moved = Array.from({ length: 400 }, (_, i) => sampleRealmSway(realm, 1, i * 0.05, 0.7, 2, 1)).some(
                (o) => Math.abs(o.z) + Math.abs(o.rotX) + Math.abs(o.rotZ) > 0.005
            );
            expect(moved, realm).toBe(true);
        }
    });

    it('never moves a card sideways: the sway and the jolts are depth and rotation only', () => {
        // The offsets have no x or y field at all; a card stays under the press that picks it.
        expect(Object.keys(sampleRealmSway('tide', 1, 1, 0, 0, 0)).sort()).toEqual(['rotX', 'rotY', 'rotZ', 'z']);
        expect(Object.keys(sampleRealmJolt('flash', 100, 0)).sort()).toEqual(['rotX', 'rotY', 'rotZ', 'z']);
    });

    it('jolts every family hard at first and not at all once it is over', () => {
        for (const family of new Set(Object.values(REALM_JOLT_FAMILY))) {
            const peak = Math.max(...Array.from({ length: 30 }, (_, i) => {
                const o = sampleRealmJolt(family, i * 20, 1.3);
                return Math.abs(o.z) + Math.abs(o.rotX) + Math.abs(o.rotY) + Math.abs(o.rotZ);
            }));
            expect(peak, family).toBeGreaterThan(0.1);
            expect(sampleRealmJolt(family, REALM_JOLT_MS, 1.3)).toBe(ZERO_REALM_OFFSET);
            expect(sampleRealmJolt(family, -1, 1.3)).toBe(ZERO_REALM_OFFSET);
        }
    });

    it('takes back exactly what it put, so the offset never compounds frame to frame', () => {
        const c = card();
        const before = JSON.stringify(c);
        for (let frame = 0; frame < 50; frame += 1) {
            takeBackRealmOffset(c);
            putRealmOffset(c, sampleRealmJolt('flash', frame * 16, 0.2));
        }
        takeBackRealmOffset(c);
        const after = JSON.parse(JSON.stringify(c));
        const was = JSON.parse(before);
        expect(after.position.z).toBeCloseTo(was.position.z, 10);
        expect(after.rotation.x).toBeCloseTo(was.rotation.x, 10);
        expect(after.rotation.y).toBeCloseTo(was.rotation.y, 10);
        expect(after.rotation.z).toBeCloseTo(was.rotation.z, 10);
    });

    it('lightning snaps its swap and a current rolls slower than the plain glide', () => {
        expect(REALM_GLIDE_SHAPE.flash!.ms).toBeLessThan(400);
        expect(REALM_GLIDE_SHAPE.surge!.ms).toBeGreaterThan(650);
    });
});
