import { describe, expect, it } from 'vitest';
import { groupCardDepartures, type DepartureMaterial, type DepartureSource } from './cardDepartureGrouping';
import {
    advanceDeparturePhysics, createDeparturePhysics, departurePhysicsBudget,
    impulseDeparturePhysics, DEPARTURE_PHYSICS_LIFE
} from './cardDeparturePhysics';

const source = (key: string, material: DepartureMaterial = 'water', x = 0, extra: Partial<DepartureSource> = {}): DepartureSource => ({
    key, material, x, y: 0, z: 0.04, floorY: -1.4, start: 0, seed: key.charCodeAt(0), combo: 0, ...extra
});
const bodyOf = (material: DepartureMaterial, sources = [source('a', material), source('b', material, 1)] ) =>
    createDeparturePhysics(groupCardDepartures(sources)[0]!, 'high');

describe('nearby departures share physical material', () => {
    it('joins a transitive neighbourhood while separating gaps, other elements and later occurrences', () => {
        const groups = groupCardDepartures([
            source('a'), source('b', 'water', 1.2), source('c', 'water', 2.4), source('far', 'water', 5),
            source('fire', 'fire'), source('later', 'water', 0, { start: 0.8 })
        ]);
        expect(groups.map(group => group.sources.map(item => item.key))).toEqual([['a', 'b', 'c'], ['far'], ['fire'], ['later']]);
        expect(groups[0]!.edges).toHaveLength(2);
    });

    it('is independent of enumeration order and unique to source seeds and departure occurrences', () => {
        const cards = [source('a'), source('b', 'water', 1)];
        expect(groupCardDepartures(cards)).toEqual(groupCardDepartures([...cards].reverse()));
        expect(groupCardDepartures(cards)[0]!.seed).not.toBe(groupCardDepartures(cards.map(card => ({ ...card, seed: card.seed + 1 })))[0]!.seed);
        expect(groupCardDepartures(cards)[0]!.seed).not.toBe(groupCardDepartures(cards.map(card => ({ ...card, key: card.key + ':again' })))[0]!.seed);
    });

    it('represents every source in a 1,024-card connected break with a bounded simulation', () => {
        const cards = Array.from({ length: 1024 }, (_, index) => source(`card-${index}`, 'water', index % 32, { y: Math.floor(index / 32) }));
        const groups = groupCardDepartures(cards);
        expect(groups).toHaveLength(1);
        expect(groups[0]!.sources).toHaveLength(1024);
        expect(groups[0]!.edges).toHaveLength(1023);
        for (const quality of ['low', 'medium', 'high'] as const) {
            const body = createDeparturePhysics(groups[0]!, quality);
            expect(body.particles.length).toBeLessThanOrEqual(departurePhysicsBudget(quality));
            expect(body.particles.reduce((sum, particle) => sum + particle.mass, 0)).toBeCloseTo(1024, 6);
        }
    });

    it('has the same trajectories at 30, 60 and 120 FPS and does not advance twice at the same time', () => {
        const results = [30, 60, 120].map(fps => {
            const body = bodyOf('water');
            for (let frame = 1; frame <= fps; frame++) advanceDeparturePhysics(body, frame / fps);
            const before = JSON.stringify(body.particles);
            advanceDeparturePhysics(body, 1);
            expect(JSON.stringify(body.particles)).toBe(before);
            return body.particles;
        });
        expect(results[0]).toEqual(results[1]);
        expect(results[1]).toEqual(results[2]);
    });

    it.each(['water', 'fire', 'growth', 'ice', 'stone'] as const)('%s halves particle work on the lean tier even for the first one or two departing cards', material => {
        for (const count of [1, 2, 3, 8]) {
            const cluster = groupCardDepartures(Array.from({ length: count }, (_, i) => source(`card-${i}`, material, i * .9)))[0]!;
            const full = createDeparturePhysics(cluster, 'high'), lean = createDeparturePhysics(cluster, 'low');
            expect(lean.particles.length).toBeGreaterThan(0);
            expect(lean.particles.length).toBeLessThanOrEqual(Math.ceil(full.particles.length / 2));
            expect(lean.drive).toBe(full.drive);
        }
    });

    it.each(['water', 'ice', 'stone'] as const)('%s falls under gravity, collides with the floor and remains behind readable cards', material => {
        const body = bodyOf(material);
        const meanY = body.particles.reduce((sum, particle) => sum + particle.y, 0) / body.particles.length;
        advanceDeparturePhysics(body, 0.35);
        expect(body.particles.reduce((sum, particle) => sum + particle.y, 0) / body.particles.length).toBeLessThan(meanY - 0.1);
        advanceDeparturePhysics(body, 1.8);
        expect(body.particles.some(particle => particle.landed)).toBe(true);
        for (const particle of body.particles) {
            expect(particle.y).toBeGreaterThanOrEqual(-1.4);
            expect(particle.z).toBeLessThan(0);
            expect(Number.isFinite(particle.vx + particle.vy + particle.vz)).toBe(true);
        }
    });

    it('an impulse changes future liquid motion and pressure transfers it to neighbouring particles', () => {
        const a = bodyOf('water'), b = bodyOf('water');
        advanceDeparturePhysics(a, 0.2); advanceDeparturePhysics(b, 0.2);
        impulseDeparturePhysics(a, a.particles[0]!.x, a.particles[0]!.y, 1.5, 0.4);
        advanceDeparturePhysics(a, 0.4); advanceDeparturePhysics(b, 0.4);
        expect(a.particles.reduce((sum, particle) => sum + particle.x, 0))
            .toBeGreaterThan(b.particles.reduce((sum, particle) => sum + particle.x, 0) + 0.05);
    });

    it('neighbouring fuel participates in one rising updraft, with continuous combo drive', () => {
        const base = bodyOf('fire');
        const initial = base.particles.reduce((sum, particle) => sum + particle.y, 0);
        advanceDeparturePhysics(base, 0.5);
        expect(base.particles.reduce((sum, particle) => sum + particle.y, 0)).toBeGreaterThan(initial + 1);
        const drives = [0, 6, 40, 100, 1000, 3000].map(combo => bodyOf('fire', [source('a', 'fire', 0, { combo })]).drive);
        drives.slice(1).forEach((drive, index) => expect(drive).toBeGreaterThan(drives[index]!));
    });

    it('vines have shared constrained junctions and transmit an impulse through their stems', () => {
        const a = bodyOf('growth'), b = bodyOf('growth');
        expect(a.stems.some(stem => stem.junction && a.particles[stem.a]!.source !== a.particles[stem.b]!.source)).toBe(true);
        advanceDeparturePhysics(a, 0.7); advanceDeparturePhysics(b, 0.7);
        const tip = a.particles[5]!;
        impulseDeparturePhysics(a, tip.x, tip.y, 1, 0.2);
        advanceDeparturePhysics(a, 0.9); advanceDeparturePhysics(b, 0.9);
        expect(Math.abs(a.particles[4]!.x - b.particles[4]!.x)).toBeGreaterThan(0.001);
        for (const stem of a.stems.filter(stem => !stem.junction)) {
            const p = a.particles[stem.a]!, q = a.particles[stem.b]!;
            expect(Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z)).toBeLessThan(stem.rest * 1.8);
        }
    });

    it('retires every material within 2.5 seconds rather than keeping a persistent physics world', () => {
        for (const material of ['water', 'fire', 'growth', 'ice', 'stone'] as const) {
            const body = bodyOf(material);
            expect(DEPARTURE_PHYSICS_LIFE[material]).toBeLessThanOrEqual(2.5);
            expect(advanceDeparturePhysics(body, 3)).toBe(false);
        }
    });

    it('an expired source stops exerting force even while a later neighbour remains alive', () => {
        const body = bodyOf('water', [source('a'), source('b', 'water', 1, { start: .4 })]);
        advanceDeparturePhysics(body, 2.21);
        const old = body.particles.filter(p => p.source === 0).map(p => ({ ...p }));
        expect(advanceDeparturePhysics(body, 2.4)).toBe(true);
        expect(body.particles.filter(p => p.source === 0)).toEqual(old);
    });
});
