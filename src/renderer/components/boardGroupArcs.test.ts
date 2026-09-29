import { describe, expect, it } from 'vitest';
import type { BoardState } from '../../shared/contracts';
import { makeRun, makeTile } from '../../shared/test/game-fixtures';
import { buildLightningPath, collectGroupArcCues, comboArcTint, comboEffectIntensity, GROUP_ARC_LEAD_SECONDS } from './boardGroupArcs';
import { createBoardParticleSystem } from './boardParticleSystem';
import { MATCH_CONTACT_SECONDS } from './boardMatchImpact';

// A 3x2 board: a clump of three same-suit pairs, and one other pair.
const board = (): BoardState => {
    const run = makeRun([
        { ...makeTile('a1', 'a', 'A'), suit: 'ember' }, { ...makeTile('b1', 'b', 'B'), suit: 'ember' }, { ...makeTile('c1', 'c', 'C'), suit: 'ember' },
        { ...makeTile('a2', 'a', 'A'), suit: 'ember' }, { ...makeTile('b2', 'b', 'B'), suit: 'ember' }, { ...makeTile('c2', 'c', 'C'), suit: 'ember' }
    ]);
    return { ...run.board!, columns: 3, rows: 2 };
};

describe('group lightning', () => {
    it('arcs a match between its cards, then strikes each broken card from the nearest one already hit', () => {
        const before = board();
        const after: BoardState = { ...before, tiles: before.tiles.map((tile) =>
            tile.pairKey === 'a' ? { ...tile, state: 'matched' }
                : tile.pairKey !== 'a' ? { ...tile, state: 'removed', brokenByChunk: true } : tile) };
        const cues = collectGroupArcCues(before, after);
        expect(cues[0]).toEqual({ fromTileId: 'a1', toTileId: 'a2', delay: MATCH_CONTACT_SECONDS, kind: 'pair' });
        const group = cues.slice(1);
        expect(group.map((cue) => cue.toTileId).sort()).toEqual(['b1', 'b2', 'c1', 'c2']);
        // Every bolt comes from a card struck before it, so the charge reads as one run through the clump.
        const struck = new Set(['a1', 'a2']);
        for (const cue of group) {
            expect(struck.has(cue.fromTileId)).toBe(true);
            expect(cue.kind).toBe('group');
            struck.add(cue.toTileId);
        }
        // c1 is two steps from a1 and one from b1: it takes its bolt from b1 once b1 is hit.
        expect(group.find((cue) => cue.toTileId === 'c1')?.fromTileId).toBe('b1');
        expect(group.every((cue) => cue.delay >= 0)).toBe(true);
        expect(GROUP_ARC_LEAD_SECONDS).toBeGreaterThan(0);
    });

    it('never replays: no bolts on mount, on an unchanged board, or without a match', () => {
        const before = board();
        const flipped: BoardState = { ...before, tiles: before.tiles.map((tile, index) => index === 0 ? { ...tile, state: 'flipped' } : tile) };
        expect(collectGroupArcCues(null, before)).toEqual([]);
        expect(collectGroupArcCues(before, before)).toEqual([]);
        expect(collectGroupArcCues(before, flipped)).toEqual([]);
    });

    it('grows with the combo and never runs away', () => {
        expect(comboEffectIntensity(0)).toBe(0);
        expect(comboEffectIntensity(3)).toBeLessThan(comboEffectIntensity(6));
        expect(comboEffectIntensity(6)).toBeLessThan(comboEffectIntensity(20));
        expect(comboEffectIntensity(500)).toBeLessThanOrEqual(1);
        expect(comboEffectIntensity(Number.NaN)).toBe(0);
        expect(comboArcTint(0)).not.toBe(comboArcTint(1));
    });

    it('draws a seeded bolt pinned to both cards', () => {
        const path = buildLightningPath(0, 0, 2, 0, 7, 6, 0.15);
        expect(path).toHaveLength(14);
        expect(path.slice(0, 2)).toEqual([0, 0]);
        expect(path.slice(-2)).toEqual([2, 0]);
        expect(path.some((value, index) => index % 2 === 1 && Math.abs(value) > 0.001)).toBe(true);
        expect(buildLightningPath(0, 0, 2, 0, 7, 6, 0.15)).toEqual(path);
    });

    it('spends more of the pool on a bigger combo, and none under reduced motion', () => {
        const pool = createBoardParticleSystem();
        const arc = { from: { x: 0, y: 0, z: 0 }, to: { x: 1.5, y: 0.5, z: 0 }, seed: 3, time: 1, reduceMotion: false, quality: 'high' as const };
        const fresh = pool.emitArc({ ...arc, intensity: 0 });
        const fever = pool.emitArc({ ...arc, intensity: 0.9 });
        expect(fresh).toBeGreaterThan(0);
        expect(fever).toBeGreaterThan(fresh * 2);
        expect(pool.mesh.geometry.getAttribute('lifetime').getW(0)).toBe(7);
        expect(pool.emitArc({ ...arc, intensity: 1, reduceMotion: true })).toBe(0);
        expect(pool.emitArc({ ...arc, intensity: 1, quality: 'low' })).toBeLessThan(fever);
        expect(pool.advance(1.02)).toBeGreaterThan(0);
        expect(pool.advance(3)).toBe(0);
        pool.dispose();
    });
});
