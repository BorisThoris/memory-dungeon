import { MeshBasicMaterial, ShaderLib, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { cardBackInkSeed, cardBackInkUniforms, installCardBackInk } from './cardBackInk';

describe('card back ink', () => {
    it('gives each card its own rosette and corners out of its seed', () => {
        const looks = new Set([1, 2, 3, 40, 500, 6000, 70000, 800000].map((seed) => cardBackInkSeed(seed).join()));
        expect(looks.size).toBeGreaterThan(6);
        for (const seed of [0, 17, 99999, 0xffffffff]) {
            const [petals] = cardBackInkSeed(seed);
            expect(petals).toBeGreaterThanOrEqual(5);
            expect(petals).toBeLessThanOrEqual(8);
        }
    });

    it('patches three’s basic shader after the alpha test, one program for every card', () => {
        const a = new MeshBasicMaterial();
        const b = new MeshBasicMaterial();
        installCardBackInk(a, 'ember', 1);
        installCardBackInk(b, 'tide', 2);
        expect(a.customProgramCacheKey()).toBe(b.customProgramCacheKey());
        const shader = { uniforms: {}, vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader } as unknown as WebGLProgramParametersWithUniforms;
        a.onBeforeCompile(shader, undefined as never);
        expect(shader.vertexShader).toContain('vInkUv = uv;');
        expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix(diffuseColor.rgb, uInkColor');
        installCardBackInk(a, 'moss', 3);
        expect(cardBackInkUniforms(a)!.uInkSeed.value.x).toBe(cardBackInkSeed(3)[0]);
    });
});
