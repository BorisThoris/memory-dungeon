import { describe, expect, it, vi } from 'vitest';
import type { Mesh, MeshBasicMaterial, Scene } from 'three';
import { prewarmCardBackShaders } from './ElementCardBack';

describe('the card back shader warm-up', () => {
    it('hands the warm-up a stand-in inked back, and the same one every floor so its program stays compiled', () => {
        const scenes: Scene[] = [];
        prewarmCardBackShaders((scene) => scenes.push(scene));
        prewarmCardBackShaders((scene) => scenes.push(scene));
        expect(scenes).toHaveLength(2);
        expect(scenes[1]).toBe(scenes[0]);
        const meshes = scenes[0]!.children as Mesh[];
        expect(meshes).toHaveLength(1);
        const material = meshes[0]!.material as MeshBasicMaterial;
        // The same program key every real card back compiles under.
        expect(material.customProgramCacheKey()).toBe('cardBackInk');
        expect(material.toneMapped).toBe(false);
        expect(material.map).not.toBeNull();
        vi.restoreAllMocks();
    });
});
