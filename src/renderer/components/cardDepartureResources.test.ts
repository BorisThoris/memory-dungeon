import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type Mesh, type ShaderMaterial, type Texture } from 'three';
import type { GraphicsQualityPreset, Tile } from '../../shared/contracts';
import { createCardElementFxSystem } from './cardElementFx';
import { createCardShardSystem } from './cardShardSystem';
import { getTileFaceOverlayTexture } from './tileTextures';

vi.mock('./tileTextures', async () => {
    const { Texture } = await import('three');
    const face = new Texture();
    return {
        getCardFaceStaticTexture: () => face,
        getTileFaceTexture: () => face,
        getTileFaceOverlayTexture: vi.fn(() => new Texture())
    };
});

const tile: Tile = { id: 'stress-card', pairKey: 'stress-pair', symbol: 'circle', label: 'Stress card', state: 'matched' };
const spawn = { tile, x: 0, y: 0, z: 0, seed: 42, time: 0, delay: 1,
    floorY: -3, quality: 'medium' as GraphicsQualityPreset, energy: 1 };

describe('departure graphics resources', () => {
    beforeEach(() => vi.clearAllMocks());

    it.each(['low', 'medium', 'high'] as const)('bounds allocations before drawing textures for a 2,048-card %s cascade', quality => {
        const elements = createCardElementFxSystem();
        const shards = createCardShardSystem();
        const budget = quality === 'low' ? 8 : quality === 'medium' ? 16 : 24;
        for (let index = 0; index < 2048; index++) {
            expect(elements.spawn({ ...spawn, quality, tile: { ...tile, suit: 'ember' } })).toBe(true);
            shards.spawn({ ...spawn, quality, tile: { ...tile, suit: 'bone' } });
        }
        expect(getTileFaceOverlayTexture).toHaveBeenCalledTimes(budget * 2);
        expect(elements.group.children).toHaveLength(budget * 2);
        expect(shards.group.children.length).toBeLessThanOrEqual(budget * 12);
        // Pending waves count too: none of these meshes has started yet.
        expect(elements.advance(0)).toBe(0);
        expect(shards.advance(0)).toBe(0);
        elements.dispose();
        shards.dispose();
    });

    it.each(['expire', 'clear'] as const)('releases owned textures, materials and geometry on %s, then accepts another wave', end => {
        const systems = [createCardElementFxSystem(), createCardShardSystem()];
        systems[0]!.spawn({ ...spawn, tile: { ...tile, suit: 'ember' } });
        systems[1]!.spawn({ ...spawn, tile: { ...tile, suit: 'bone' } });
        const meshes = systems.flatMap(system => system.group.children as Mesh[]);
        const geometries = [...new Set(meshes.map(mesh => mesh.geometry))];
        const materials = [...new Set(meshes.map(mesh => mesh.material as ShaderMaterial))];
        const overlays = [...new Set(materials.map(material => material.uniforms.uOverlay!.value as Texture))];
        const disposals = [...geometries, ...materials, ...overlays].map(resource => vi.spyOn(resource, 'dispose'));
        const cacheTextures = vi.mocked(getTileFaceOverlayTexture).mock.results.map(result => result.value as Texture);
        overlays.forEach((overlay, index) => {
            expect(overlay).not.toBe(cacheTextures[index]);
            expect(overlay.source).toBe(cacheTextures[index]!.source);
            // Eviction of the card's cache entry must not take ownership of the effect's clone.
            cacheTextures[index]!.dispose();
        });
        for (const system of systems) {
            if (end === 'expire') expect(system.advance(10)).toBe(0);
            else system.clear();
            expect(system.group.children).toHaveLength(0);
        }
        disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
        expect(systems[0]!.spawn({ ...spawn, tile: { ...tile, suit: 'ember' } })).toBe(true);
        expect(systems[1]!.spawn({ ...spawn, tile: { ...tile, suit: 'bone' } })).toBeGreaterThan(0);
        systems.forEach(system => system.dispose());
    });
});
