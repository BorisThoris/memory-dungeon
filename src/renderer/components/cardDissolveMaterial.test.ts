import { MeshStandardMaterial, ShaderLib, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import { cardDissolveUniforms, installCardDissolve, setCardDissolve } from './cardDissolveMaterial';

const compile = (material: MeshStandardMaterial) => {
    const shader = {
        uniforms: {},
        vertexShader: ShaderLib.standard.vertexShader,
        fragmentShader: ShaderLib.standard.fragmentShader
    } as unknown as WebGLProgramParametersWithUniforms;
    material.onBeforeCompile(shader, undefined as never);
    return shader;
};

describe('card dissolve', () => {
    it('patches three’s own standard shader at points that exist in it', () => {
        const material = new MeshStandardMaterial();
        installCardDissolve(material, 'ember');
        const shader = compile(material);
        expect(shader.vertexShader).toContain('vDissolveUv = uv;');
        expect(shader.fragmentShader).toContain('uniform float uDissolve;');
        expect(shader.fragmentShader).toContain('if (n < threshold) discard;');
        expect(shader.uniforms.uDissolve).toBe(cardDissolveUniforms(material)!.uDissolve);
    });

    it('shares one program between cards, a uniform of its own each, edged in the element', () => {
        const fire = new MeshStandardMaterial();
        const water = new MeshStandardMaterial();
        installCardDissolve(fire, 'ember');
        installCardDissolve(water, 'tide');
        expect(fire.customProgramCacheKey()).toBe(water.customProgramCacheKey());
        expect(cardDissolveUniforms(fire)!.uDissolveEdge.value.getHexString()).not.toBe(cardDissolveUniforms(water)!.uDissolveEdge.value.getHexString());
        setCardDissolve(fire, 0.4);
        expect(cardDissolveUniforms(fire)!.uDissolve.value).toBe(0.4);
        expect(cardDissolveUniforms(water)!.uDissolve.value).toBe(0);
        setCardDissolve(fire, 3);
        expect(cardDissolveUniforms(fire)!.uDissolve.value).toBe(1);
    });

    it('installs once: a second call only recolours the edge', () => {
        const material = new MeshStandardMaterial();
        installCardDissolve(material, 'ember');
        const first = cardDissolveUniforms(material);
        installCardDissolve(material, 'moss');
        expect(cardDissolveUniforms(material)).toBe(first);
    });
});
