import { describe, expect, it } from 'vitest';
import { testHallRoom, playTestHallStep } from '../../shared/test-hall-rooms';
import { collectElementCastParticles } from './elementCastParticles';
import { createBoardParticleSystem, boardParticleBudget } from './boardParticleSystem';

const before = testHallRoom('element-blocks').build();
const after = playTestHallStep(before, { do: 'match', pairKey: 'a' })!;

describe('quiet elemental casts in the shared particle pool', () => {
    it('does not replay on mount, the same event, or reduced motion', () => {
        expect(collectElementCastParticles(null, after.board!, 'high', false, false, 0)).toEqual([]);
        expect(collectElementCastParticles(after.board!, after.board!, 'high', false, false, 0)).toEqual([]);
        expect(collectElementCastParticles(before.board!, after.board!, 'high', false, true, 0)).toEqual([]);
    });
    it.each(['low', 'medium', 'high'] as const)('bounds a large cast at %s quality and preserves all response types', quality => {
        const cues = collectElementCastParticles(before.board!, after.board!, quality, false, false, 1);
        expect(cues.length).toBeGreaterThan(0);
        expect(cues.length).toBeLessThanOrEqual(19);
        expect(cues.some(c => c.tint === '#e7c879')).toBe(true);
        expect(cues.some(c => c.tint === '#aebfca')).toBe(true);
        expect(cues.some(c => c.shape === 'leaf')).toBe(true);
        const pool = createBoardParticleSystem();
        const count = cues.reduce((sum, cue) => sum + pool.emit(cue), 0);
        expect(count).toBeLessThanOrEqual(38);
        expect(pool.advance(1.3)).toBeLessThanOrEqual(boardParticleBudget(quality));
        expect(pool.advance(4)).toBe(0);
        pool.dispose();
    });
    it('keeps casts visible when cosmetic match bursts fill the pool', () => {
        const pool = createBoardParticleSystem();
        for (let i = 0; i < 20; i += 1) pool.emit({ kind: 'match', x: 0, y: 0, z: 0,
            time: 1, seed: i, reduceMotion: false, quality: 'low' });
        const data = pool.mesh.geometry.getAttribute('lifetime').array.slice();
        const cues = collectElementCastParticles(before.board!, after.board!, 'low', false, false, 1);
        expect(cues.reduce((n, c) => n + pool.emit(c), 0)).toBeGreaterThan(0);
        expect(pool.mesh.geometry.getAttribute('lifetime').array).not.toEqual(data);
        expect(pool.advance(1.3)).toBeLessThanOrEqual(boardParticleBudget('low'));
        expect(pool.advance(4)).toBe(0);
        pool.dispose();
    });
});
