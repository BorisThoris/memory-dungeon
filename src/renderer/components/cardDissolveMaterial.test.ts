import { MeshStandardMaterial, ShaderLib, SRGBColorSpace, type Mesh, type MeshBasicMaterial, type Scene, type WebGLProgramParametersWithUniforms } from 'three';
import { describe, expect, it } from 'vitest';
import {
    CARD_DISSOLVE_STYLE,
    cardDissolveUniforms,
    createCardDissolveUniforms,
    installCardDissolve,
    prewarmCardFaceOverlayShaders,
    setCardDissolve
} from './cardDissolveMaterial';

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
        expect(shader.fragmentShader).toContain('if (field < threshold) discard;');
        expect(shader.fragmentShader).toContain('float cardDissolveField(');
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

    it('breaks each element up its own way, offset by the card', () => {
        const styles = new Set(Object.values(CARD_DISSOLVE_STYLE));
        expect(styles.size).toBe(5);
        const fire = new MeshStandardMaterial();
        installCardDissolve(fire, 'ember', { seed: 101 });
        expect(cardDissolveUniforms(fire)!.uDissolveStyle.value).toBe(CARD_DISSOLVE_STYLE.ember);
        const other = new MeshStandardMaterial();
        installCardDissolve(other, 'ember', { seed: 202 });
        expect(cardDissolveUniforms(fire)!.uDissolveSeed.value.equals(cardDissolveUniforms(other)!.uDissolveSeed.value)).toBe(false);
        installCardDissolve(fire, 'bone', { seed: 101 });
        expect(cardDissolveUniforms(fire)!.uDissolveStyle.value).toBe(CARD_DISSOLVE_STYLE.bone);
    });

    it('lets a card share one set of uniforms between its surfaces, so they burn as one', () => {
        const shared = createCardDissolveUniforms();
        const front = new MeshStandardMaterial();
        const back = new MeshStandardMaterial();
        installCardDissolve(front, 'tide', { uniforms: shared, seed: 7 });
        installCardDissolve(back, 'tide', { uniforms: shared, seed: 7 });
        setCardDissolve(front, 0.5);
        expect(cardDissolveUniforms(back)!.uDissolve.value).toBe(0.5);
        expect(shared.uDissolveStyle.value).toBe(CARD_DISSOLVE_STYLE.tide);
    });
});

describe('the face illustration shader warm-up', () => {
    it('hands the warm-up a visible stand-in with the settings that pick the illustration program, the same one every floor', () => {
        const scenes: Scene[] = [];
        prewarmCardFaceOverlayShaders((scene) => scenes.push(scene));
        prewarmCardFaceOverlayShaders((scene) => scenes.push(scene));
        expect(scenes[1]).toBe(scenes[0]);
        const meshes = scenes[0]!.children as Mesh[];
        expect(meshes).toHaveLength(1);
        // A renderer's compile skips what is hidden: the real illustrations are, until the first flip.
        expect(meshes[0]!.visible).toBe(true);
        const material = meshes[0]!.material as MeshBasicMaterial;
        // What `TileBoardEffectOverlays` gives the illustration, so the two share one program.
        expect(material.customProgramCacheKey()).toBe('cardDissolve');
        expect(material.map?.colorSpace).toBe(SRGBColorSpace);
        expect(material.alphaTest).toBe(0.08);
        expect(material.toneMapped).toBe(false);
    });
});
