import { describe, expect, it, vi } from 'vitest';
import { Matrix4, Vector3 } from 'three';
import { BOARD_PARTICLE_SHAPE_KIND, boardParticleBudget, createBoardParticleSystem, type BoardParticleBurst } from './boardParticleSystem';

const burst: BoardParticleBurst = { kind: 'bomb', x: 1, y: 2, z: 0.1, seed: 41, time: 1,
    reduceMotion: false, quality: 'high' };

describe('the shared board particle pool', () => {
    it('lifts combo embers off a card in free slots, in the heat\'s colour, and none under reduced motion', () => {
        const pool = createBoardParticleSystem();
        const emitted = pool.emit({ ...burst, kind: 'ember', energy: 0.8, tint: '#ff4d5e' });
        expect(emitted).toBeGreaterThan(0);
        const movement = pool.mesh.geometry.getAttribute('movement');
        const tint = pool.mesh.geometry.getAttribute('tint');
        for (let index = 0; index < emitted; index += 1) {
            expect(movement.getY(index)).toBeGreaterThan(0);
            // Negative gravity: the spark rises faster as it lives rather than falling.
            expect(movement.getZ(index)).toBeLessThan(0);
            expect(tint.getX(index)).toBeCloseTo(1, 1);
        }
        expect(pool.emit({ ...burst, kind: 'ember', reduceMotion: true })).toBe(0);
        // An explosion filling the pool leaves the embers nowhere to go: they never evict it.
        for (let i = 0; i < 40; i += 1) pool.emit({ ...burst, seed: i });
        expect(pool.emit({ ...burst, kind: 'ember', time: 1.01 })).toBe(0);
        pool.dispose();
    });

    it('draws each element as its own material, moving as that material moves', () => {
        const pool = createBoardParticleSystem();
        const movement = pool.mesh.geometry.getAttribute('movement');
        const lifetime = pool.mesh.geometry.getAttribute('lifetime');
        const rotation = pool.mesh.geometry.getAttribute('rotation');
        let slot = 0;
        for (const shape of ['flame', 'droplet', 'shard', 'leaf'] as const) {
            const emitted = pool.emit({ ...burst, kind: 'ember', energy: 0.6, tint: '#5fb8f2', shape });
            expect(emitted, shape).toBeGreaterThan(0);
            for (let index = slot; index < slot + emitted; index += 1) {
                expect(lifetime.getW(index), shape).toBe(BOARD_PARTICLE_SHAPE_KIND[shape]);
                // A flame climbs and climbs faster; a drop falls under its own weight; a leaf sinks.
                if (shape === 'flame') {
                    expect(movement.getY(index)).toBeGreaterThan(0);
                    expect(movement.getZ(index)).toBeLessThan(0);
                    expect(rotation.getX(index)).toBe(0);
                }
                if (shape === 'droplet') {
                    expect(movement.getZ(index)).toBeGreaterThan(0.5);
                    expect(rotation.getY(index)).toBe(0);
                }
                if (shape === 'leaf') expect(movement.getY(index)).toBeLessThan(0);
            }
            slot += emitted;
        }
        // Element motes take free slots only, and none under reduced motion.
        expect(pool.emit({ ...burst, kind: 'ember', shape: 'flame', reduceMotion: true })).toBe(0);
        for (let i = 0; i < 40; i += 1) pool.emit({ ...burst, seed: i });
        expect(pool.emit({ ...burst, kind: 'ember', shape: 'flame', time: 1.01 })).toBe(0);
        pool.dispose();
    });

    it('places staggered contact ripples on the board using the same bounded buffers', () => {
        const pool = createBoardParticleSystem();
        expect(pool.emit({ ...burst, kind: 'ripple', delay: 0.14 })).toBe(3);
        expect(pool.rippleMesh.geometry).toBe(pool.mesh.geometry);
        expect(pool.rippleMesh.renderOrder).toBeLessThan(pool.mesh.renderOrder);
        const origin = pool.mesh.geometry.getAttribute('origin');
        const lifetime = pool.mesh.geometry.getAttribute('lifetime');
        for (let index = 0; index < 3; index += 1) {
            expect(origin.getX(index)).toBe(1);
            expect(origin.getY(index)).toBe(2);
            expect(origin.getZ(index)).toBeCloseTo(-0.025);
            expect(lifetime.getX(index)).toBeCloseTo(1.14 + index * 0.085);
            expect(lifetime.getW(index)).toBe(6);
        }
        expect(pool.emit({ ...burst, kind: 'ripple', reduceMotion: true })).toBe(0);
        for (let index = 0; index < 20; index += 1) pool.emit(burst);
        // A busy cascade must leave the contact rings readable until their own fade finishes.
        expect([0, 1, 2].map(index => lifetime.getW(index))).toEqual([6, 6, 6]);
        expect(pool.advance(3)).toBe(0);
        expect(pool.rippleMesh.visible).toBe(false);
        pool.dispose();
    });
    it('reuses its buffers and stays bounded during a large cascade', () => {
        const pool = createBoardParticleSystem();
        const geometry = pool.mesh.geometry;
        const positions = geometry.getAttribute('origin').array;
        for (let i = 0; i < 100; i += 1) pool.emit({ ...burst, seed: i });
        expect(pool.advance(1.1)).toBe(boardParticleBudget('high'));
        expect(pool.mesh.geometry).toBe(geometry);
        expect(geometry.getAttribute('origin').array).toBe(positions);
        expect(pool.advance(3)).toBe(0);
        expect(pool.mesh.visible).toBe(false);
        pool.dispose();
    });

    it('caps lower qualities and clears old slots when the budget changes', () => {
        const pool = createBoardParticleSystem();
        for (let i = 0; i < 20; i += 1) pool.emit(burst);
        pool.emit({ ...burst, quality: 'low' });
        expect(pool.advance(1.1)).toBeLessThanOrEqual(boardParticleBudget('low'));
        for (let i = 0; i < 20; i += 1) pool.emit({ ...burst, quality: 'low' });
        expect(pool.advance(1.1)).toBe(boardParticleBudget('low'));
        pool.configure('medium');
        expect(pool.mesh.geometry.instanceCount).toBe(boardParticleBudget('medium'));
        expect(pool.advance(1.1)).toBe(0);
        pool.dispose();
    });

    it('uses a stationary fade for reduced motion and suppresses flip sparkles', () => {
        const pool = createBoardParticleSystem();
        expect(pool.emit({ ...burst, reduceMotion: true })).toBe(1);
        const movement = pool.mesh.geometry.getAttribute('movement');
        expect([movement.getX(0), movement.getY(0), movement.getZ(0)]).toEqual([0, 0, 0]);
        expect(pool.mesh.geometry.getAttribute('lifetime').getW(0)).toBe(3);
        expect(pool.emit({ ...burst, reduceMotion: true, kind: 'flip' })).toBe(0);
        expect(pool.emit({ ...burst, reduceMotion: true, kind: 'rim' })).toBe(0);
        expect(pool.advance(1.6)).toBe(0);
        pool.dispose();
    });

    it('keeps ambient rim trails from overwriting a busy impact pool', () => {
        const pool = createBoardParticleSystem();
        for (let i = 0; i < 20; i += 1) pool.emit(burst);
        const before = pool.mesh.geometry.getAttribute('origin').array.slice();
        expect(pool.emit({ ...burst, kind: 'rim' })).toBe(0);
        expect(pool.mesh.geometry.getAttribute('origin').array).toEqual(before);
        expect(pool.emit({ ...burst, kind: 'rim', time: 3 })).toBeGreaterThan(0);
        pool.dispose();
    });

    it('places the match sweep on the tilted and scaled card perimeter', () => {
        const pool = createBoardParticleSystem();
        const cardMatrix = new Matrix4().makeRotationZ(0.6).scale(new Vector3(0.8, 0.8, 0.8)).setPosition(3, 4, 0.2);
        const count = pool.emit({ ...burst, kind: 'match', cardMatrix, energy: 1 });
        const origin = pool.mesh.geometry.getAttribute('origin');
        const inverse = cardMatrix.clone().invert();
        for (let i = 0; i < count; i += 1) {
            const local = new Vector3(origin.getX(i), origin.getY(i), origin.getZ(i) - 0.06).applyMatrix4(inverse);
            expect(Math.abs(local.x)).toBeLessThanOrEqual(0.383);
            expect(Math.abs(local.y)).toBeLessThanOrEqual(0.553);
            expect(Math.max(Math.abs(local.x) / 0.37, Math.abs(local.y) / 0.54)).toBeGreaterThan(0.9);
        }
        expect(pool.advance(2.5)).toBe(0);
        pool.dispose();
    });

    it('keeps delayed wave particles alive until their scheduled burst finishes', () => {
        const pool = createBoardParticleSystem();
        pool.emit({ ...burst, kind: 'chain', delay: 1.2 });
        expect(pool.mesh.geometry.getAttribute('lifetime').getX(0)).toBeCloseTo(2.2);
        expect(pool.advance(2.3)).toBeGreaterThan(0);
        expect(pool.advance(4)).toBe(0);
        pool.dispose();
    });

    it('is repeatable without touching the gameplay RNG and disposes its GPU resources', () => {
        const a = createBoardParticleSystem();
        const b = createBoardParticleSystem();
        a.emit(burst); b.emit(burst);
        expect(a.mesh.geometry.getAttribute('movement').array).toEqual(b.mesh.geometry.getAttribute('movement').array);
        const geometryDisposed = vi.fn();
        const materialDisposed = vi.fn();
        a.mesh.geometry.addEventListener('dispose', geometryDisposed);
        a.mesh.material.addEventListener('dispose', materialDisposed);
        a.clear();
        expect(a.advance(1.1)).toBe(0);
        a.dispose(); b.dispose();
        expect(geometryDisposed).toHaveBeenCalledOnce();
        expect(materialDisposed).toHaveBeenCalledOnce();
    });
});
