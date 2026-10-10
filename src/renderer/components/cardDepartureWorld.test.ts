import { describe, expect, it, vi } from 'vitest';
import { PlaneGeometry, type Mesh, type Material } from 'three';
import { createCardDepartureWorld } from './cardDepartureWorld';
import { createDepartureSheet } from './cardDepartureSheet';
import type { DepartureSource } from './cardDepartureGrouping';

const source = (key: string, x = 0, start = 0, material: DepartureSource['material'] = 'water'): DepartureSource =>
    ({ key, material, x, y: 0, z: .04, start, floorY: -1.2, seed: key.charCodeAt(0), combo: 30 });

describe('shared departure world', () => {
    it('joins neighbouring arrivals without resetting their positions or momentum', () => {
        const world = createCardDepartureWorld();
        world.spawnWave([source('a')], 'high'); world.advance(.25);
        const before = { ...world.binding('a')!.body.particles[0]! };
        world.spawnWave([source('b', 1, .3)], 'high');
        const after = world.binding('a')!.body.particles[0]!;
        expect(after.x).toBe(before.x); expect(after.y).toBe(before.y);
        expect(after.vx).toBe(before.vx); expect(after.vy).toBe(before.vy);
        expect(world.stats()).toEqual({ groups: 1, particles: 24, sources: 2 });
        expect(world.binding('a')!.body).toBe(world.binding('b')!.body);
        world.dispose();
    });

    it('bounds isolated groups, including pending arrivals, before allocating GPU resources', () => {
        const world = createCardDepartureWorld();
        world.spawnWave(Array.from({ length: 2048 }, (_, i) => source(String(i), i * 4, 1)), 'low');
        expect(world.stats().groups).toBe(4);
        expect(world.stats().particles).toBeLessThanOrEqual(96);
        expect(world.group.children).toHaveLength(4);
        world.advance(0);
        expect(world.group.children.every(child => !child.visible)).toBe(true);
        world.dispose();
    });

    it('releases geometry/materials once on merge and clear, and retires old source bindings during continual arrivals', () => {
        const world = createCardDepartureWorld();
        world.spawnWave([source('a')], 'high');
        const mesh = world.group.children[0] as Mesh;
        const geometry = vi.spyOn(mesh.geometry, 'dispose');
        const material = vi.spyOn(mesh.material as Material, 'dispose');
        for (let i = 1; i < 50; i++) {
            world.advance(i * .3);
            world.spawnWave([source(`a${i}`, 0, i * .3)], 'high');
            expect(world.stats().sources).toBeLessThanOrEqual(9);
        }
        expect(world.binding('a')).toBeUndefined();
        expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
        world.advance(20); expect(world.stats()).toEqual({ groups: 0, particles: 0, sources: 0 });
        world.clear(); world.dispose();
        expect(geometry).toHaveBeenCalledTimes(1); expect(material).toHaveBeenCalledTimes(1);
    });

    it.each(['water', 'fire', 'growth', 'ice', 'stone'] as const)('%s has finite bounded render buffers and cleans up after its last source', material => {
        const world = createCardDepartureWorld();
        world.spawnWave([source('a', 0, 0, material), source('b', 1, .15, material)], 'high');
        for (let frame = 0; frame < 240; frame++) world.advance(frame / 120);
        for (const child of world.group.children) {
            const mesh = child as Mesh;
            for (const value of mesh.geometry.attributes.position!.array) expect(Number.isFinite(value)).toBe(true);
        }
        world.advance(3); expect(world.group.children).toHaveLength(0);
        world.dispose();
    });

    it('deforms the real card face with inertia and floor contact, consistently across frame rates', () => {
        const geometry = new PlaneGeometry(.74, 1.08, 4, 6);
        const original = geometry.attributes.position!.array as Float32Array;
        const outputs = [30, 60, 120].map(fps => {
            const sheet = createDepartureSheet(original, 4, 6, 'water', 42);
            for (let frame = 1; frame <= fps; frame++) sheet.advance(frame / fps, -1.2);
            return sheet.positions;
        });
        expect(outputs[0]).toEqual(outputs[1]); expect(outputs[1]).toEqual(outputs[2]);
        expect(outputs[0]).not.toEqual(original);
        for (let i = 1; i < original.length; i += 3) expect(outputs[0]![i]).toBeGreaterThanOrEqual(-1.200001);
        geometry.dispose();
    });
});
