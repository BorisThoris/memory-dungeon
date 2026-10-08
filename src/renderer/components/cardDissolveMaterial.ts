import { Color, type MeshStandardMaterial } from 'three';
import type { TileSuit } from '../../shared/contracts';

/**
 * Cards burn away (2026-10-08). A card leaving the board (a match, a pop, a bomb, a meteor) used
 * to shrink to nothing in a quarter of a second. Now, as it shrinks, it dissolves: a noise field
 * eats the card from scattered points, and the edge of every hole glows in the card's own element:
 * embers for fire, a cyan rim for water, white frost for ice, green for growth.
 *
 * Installed on the card's two surface materials (`TileBezel`) with `onBeforeCompile`, so every card
 * shares one compiled program and only its uniform differs, and driven by the departure the frame
 * already computes (`tileBoardFrameAdvance.ts`). Reduced motion keeps the plain shrink.
 */
export const CARD_DISSOLVE_EDGE: Readonly<Record<TileSuit | 'none', string>> = {
    ember: '#ff8a2a',
    tide: '#5fd8ff',
    bone: '#e8f6ff',
    moss: '#8ef05a',
    none: '#ffd38a'
};

interface CardDissolveUniforms {
    uDissolve: { value: number };
    uDissolveEdge: { value: Color };
}

const DISSOLVE_KEY = 'cardDissolve';

/** The material's dissolve uniforms, once installed. */
export const cardDissolveUniforms = (material: MeshStandardMaterial | null | undefined): CardDissolveUniforms | null =>
    (material?.userData?.[DISSOLVE_KEY] as CardDissolveUniforms | undefined) ?? null;

/** Install the dissolve on a card surface material (idempotent). */
export const installCardDissolve = (material: MeshStandardMaterial, suit: TileSuit | undefined): void => {
    const edge = new Color(CARD_DISSOLVE_EDGE[suit ?? 'none']);
    const existing = cardDissolveUniforms(material);
    if (existing) {
        existing.uDissolveEdge.value.copy(edge);
        return;
    }
    const uniforms: CardDissolveUniforms = { uDissolve: { value: 0 }, uDissolveEdge: { value: edge } };
    material.userData[DISSOLVE_KEY] = uniforms;
    material.customProgramCacheKey = () => DISSOLVE_KEY;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uDissolve = uniforms.uDissolve;
        shader.uniforms.uDissolveEdge = uniforms.uDissolveEdge;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vDissolveUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDissolveUv = uv;');
        shader.fragmentShader = shader.fragmentShader
            .replace(
                '#include <common>',
                `#include <common>
varying vec2 vDissolveUv;
uniform float uDissolve;
uniform vec3 uDissolveEdge;
float dissolveHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float dissolveNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(dissolveHash(i), dissolveHash(i + vec2(1.0, 0.0)), u.x), mix(dissolveHash(i + vec2(0.0, 1.0)), dissolveHash(i + vec2(1.0, 1.0)), u.x), u.y);
}`
            )
            .replace(
                '#include <dithering_fragment>',
                `#include <dithering_fragment>
if (uDissolve > 0.0) {
    float n = dissolveNoise(vDissolveUv * 6.0) * 0.65 + dissolveNoise(vDissolveUv * 17.0) * 0.35;
    float threshold = uDissolve * 1.12 - 0.06;
    if (n < threshold) discard;
    float rim = 1.0 - smoothstep(0.0, 0.09, n - threshold);
    gl_FragColor.rgb = mix(gl_FragColor.rgb, uDissolveEdge * 2.4, rim);
}`
            );
    };
    material.needsUpdate = true;
};

/** Set how far the card has burned away, 0 (whole) to 1 (gone). */
export const setCardDissolve = (material: MeshStandardMaterial | null | undefined, amount: number): void => {
    const uniforms = cardDissolveUniforms(material);
    if (!uniforms) return;
    const next = Math.min(1, Math.max(0, amount));
    if (uniforms.uDissolve.value !== next) uniforms.uDissolve.value = next;
};
