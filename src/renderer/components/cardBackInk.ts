import { Color, Vector3, type MeshBasicMaterial } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * Every card back its own (2026-10-09). The four element backs are shared canvas textures
 * (`ElementCardBack.tsx`), so a back per card would be a texture per card. Instead the shader inks
 * hairlines over the shared art, seeded by the card: a guilloche rosette around the rune with its
 * own number of petals and turn, an inner border rule, and hatching in two of the corners at the
 * card's own angle. Ink and paper only: thin lines in the element's rune light, never a fill, and
 * the rune itself left clear.
 */
export const CARD_BACK_INK: Readonly<Record<TileSuit, string>> = {
    ember: '#ffd278',
    tide: '#c8f5ff',
    bone: '#ffffff',
    moss: '#dcfa96'
};

interface CardBackInkUniforms {
    uInkSeed: { value: Vector3 };
    uInkColor: { value: Color };
}

const INK_KEY = 'cardBackInk';

/** Petals 5 to 8, a phase, and a hatch angle, all out of the card's seed. */
export const cardBackInkSeed = (seed: number): [petals: number, phase: number, hatch: number] => {
    const s = seed >>> 0;
    return [5 + (s % 4), ((s >>> 3) % 360) * (Math.PI / 180), (((s >>> 12) % 4) * 0.25 + 0.125) * Math.PI];
};

export const cardBackInkUniforms = (material: MeshBasicMaterial | null | undefined): CardBackInkUniforms | null =>
    (material?.userData?.[INK_KEY] as CardBackInkUniforms | undefined) ?? null;

const FRAGMENT = /* glsl */ `
if (diffuseColor.a > 0.5) {
    vec2 size = vec2(${CARD_PLANE_WIDTH.toFixed(3)}, ${CARD_PLANE_HEIGHT.toFixed(3)});
    vec2 p = (vInkUv - 0.5) * size;
    vec2 q = p - vec2(0.0, 0.02 * size.y);
    float r = length(q);
    float theta = atan(q.y, q.x);
    float w = 0.0022;
    // The rosette: two interlaced strands around the rune, never inside it.
    float ink = 0.0;
    for (int strand = 0; strand < 2; strand++) {
        float target = 0.178 + 0.014 * sin(uInkSeed.x * theta + uInkSeed.y + float(strand) * 3.14159 / uInkSeed.x);
        float d = abs(r - target);
        ink = max(ink, 1.0 - smoothstep(w * 0.4, w + fwidth(r), d));
    }
    // The border rule, inset from the painted edge.
    vec2 b = abs(p) - (size * 0.5 - vec2(0.088));
    float box = length(max(b, 0.0)) + min(max(b.x, b.y), 0.0) - 0.026;
    ink = max(ink, (1.0 - smoothstep(w * 0.4, w + fwidth(box), abs(box))) * 0.8);
    // Hatching in the two corners the card's angle points to.
    vec2 dir = vec2(cos(uInkSeed.z), sin(uInkSeed.z));
    // A triangle cut along the corner's diagonal, inside the rule.
    float corner = step(1.34, abs(p.x) / (size.x * 0.5) + abs(p.y) / (size.y * 0.5)) * step(0.0, p.x * p.y * sign(dir.x)) * step(box, -0.008);
    float hatch = abs(fract(dot(p, vec2(-dir.y, dir.x)) / 0.016) - 0.5) * 0.016;
    ink = max(ink, corner * (1.0 - smoothstep(w * 0.3, w + fwidth(hatch), hatch)) * 0.55);
    diffuseColor.rgb = mix(diffuseColor.rgb, uInkColor, ink * 0.42);
}`;

/** Ink the per-card hairlines over an element back (idempotent; a second call re-seeds). */
export const installCardBackInk = (material: MeshBasicMaterial, suit: TileSuit, seed: number): void => {
    const [petals, phase, hatch] = cardBackInkSeed(seed);
    const existing = cardBackInkUniforms(material);
    if (existing) {
        existing.uInkSeed.value.set(petals, phase, hatch);
        existing.uInkColor.value.set(CARD_BACK_INK[suit]);
        return;
    }
    const uniforms: CardBackInkUniforms = {
        uInkSeed: { value: new Vector3(petals, phase, hatch) },
        uInkColor: { value: new Color(CARD_BACK_INK[suit]) }
    };
    material.userData[INK_KEY] = uniforms;
    material.customProgramCacheKey = () => INK_KEY;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uInkSeed = uniforms.uInkSeed;
        shader.uniforms.uInkColor = uniforms.uInkColor;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vInkUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvInkUv = uv;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vInkUv;\nuniform vec3 uInkSeed;\nuniform vec3 uInkColor;')
            .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>\n${FRAGMENT}`);
    };
    material.needsUpdate = true;
};
