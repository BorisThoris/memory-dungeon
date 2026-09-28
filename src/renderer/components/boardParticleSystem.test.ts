import { describe, expect, it, vi } from 'vitest';
import { boardParticleBudget, createBoardParticleSystem, type BoardParticleBurst } from './boardParticleSystem';

const burst: BoardParticleBurst = { kind: 'bomb', x: 1, y: 2, z: 0.1, seed: 41, time: 1,
    reduceMotion: false, quality: 'high' };

describe('the shared board particle pool', () => {
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
        expect(pool.advance(1.1)).toBe(96);
        pool.configure('medium');
        expect(pool.mesh.geometry.instanceCount).toBe(192);
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
        expect(pool.advance(1.6)).toBe(0);
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
