import { Color, Vector2, type MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import type { TileSuit } from '../../shared/contracts';

/**
 * Cards burn away (2026-10-08). A card leaving the board (a match, a pop, a bomb, a meteor) used
 * to shrink to nothing in a quarter of a second. Now, as it shrinks, it dissolves, and the edge of
 * every hole glows in the card's own element.
 *
 * Each element leaves its own way (2026-10-09): fire burns up from the foot of the card with a
 * scorched band ahead of the flame; water runs off from the top in streaks, the paper darkening as
 * it soaks; ice cracks first and then falls away a whole shard at a time; growth opens from the
 * heart outward with a bloom ahead of the edge. A card with no element keeps the scattered holes.
 * The pattern is offset by the card's own layout seed, so no two cards break the same way.
 *
 * Installed on the card's two surface materials (`TileBezel`) with `onBeforeCompile`, so every card
 * shares one compiled program and only its uniforms differ, and driven by the departure the frame
 * already computes (`tileBoardFrameAdvance.ts`). The illustration drawn over the face is a smaller
 * plane of its own; it takes the same uniforms with its uv scaled into the card's, so it burns along
 * the same front instead of floating whole over the holes. The element rim drawn over the card
 * (`ElementCardMaterial`) reads the same uniforms and field, so it burns with the card instead of
 * hanging over the holes. Reduced motion keeps the plain shrink.
 */
export const CARD_DISSOLVE_EDGE: Readonly<Record<TileSuit | 'none', string>> = {
    ember: '#ff8a2a',
    tide: '#5fd8ff',
    bone: '#e8f6ff',
    moss: '#8ef05a',
    none: '#ffd38a'
};

/** The shader's code for how each element breaks up. */
export const CARD_DISSOLVE_STYLE: Readonly<Record<TileSuit | 'none', number>> = {
    none: 0,
    ember: 1,
    tide: 2,
    bone: 3,
    moss: 4
};

export interface CardDissolveUniforms {
    uDissolve: { value: number };
    uDissolveEdge: { value: Color };
    uDissolveStyle: { value: number };
    uDissolveSeed: { value: Vector2 };
}

const DISSOLVE_KEY = 'cardDissolve';

/** A card's own dissolve uniforms: one set, shared by its two surfaces and its element rim. */
export const createCardDissolveUniforms = (suit?: TileSuit, seed = 0): CardDissolveUniforms => {
    const uniforms: CardDissolveUniforms = {
        uDissolve: { value: 0 },
        uDissolveEdge: { value: new Color() },
        uDissolveStyle: { value: 0 },
        uDissolveSeed: { value: new Vector2() }
    };
    setCardDissolveLook(uniforms, suit, seed);
    return uniforms;
};

/** Colour, pattern and per-card offset for an element (a Turncoat's card changes element in place). */
export const setCardDissolveLook = (uniforms: CardDissolveUniforms, suit: TileSuit | undefined, seed: number): void => {
    uniforms.uDissolveEdge.value.set(CARD_DISSOLVE_EDGE[suit ?? 'none']);
    uniforms.uDissolveStyle.value = CARD_DISSOLVE_STYLE[suit ?? 'none'];
    // Two independent offsets out of the seed, kept small enough for the hash to stay precise in mediump.
    uniforms.uDissolveSeed.value.set(((seed >>> 0) % 997) * 0.173, ((seed >>> 10) % 991) * 0.131);
};

/**
 * The shared field: where on the card (uv 0..1) the dissolve reaches first (low) and last (high).
 * `crack` is set to how close the point is to an ice shard's border.
 */
export const CARD_DISSOLVE_GLSL = /* glsl */ `
float cardDissolveHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
vec2 cardDissolveHash2(vec2 p) { return fract(sin(vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)))) * 43758.5453); }
float cardDissolveNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(cardDissolveHash(i), cardDissolveHash(i + vec2(1.0, 0.0)), u.x), mix(cardDissolveHash(i + vec2(0.0, 1.0)), cardDissolveHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float cardDissolveField(vec2 uv, float style, vec2 seed, out float crack) {
    crack = 0.0;
    float n = cardDissolveNoise(uv * 6.0 + seed) * 0.65 + cardDissolveNoise(uv * 17.0 + seed.yx) * 0.35;
    if (style < 0.5) return n;
    if (style < 1.5) {
        // Fire: from the foot of the card upward, the flame front ragged.
        return clamp(uv.y * 0.62 + n * 0.48 - 0.05, 0.0, 1.0);
    }
    if (style < 2.5) {
        // Water: runs off from the top, in long streaks that hang down.
        float streak = cardDissolveNoise(vec2(uv.x * 15.0 + seed.x, uv.y * 1.6 + seed.y));
        return clamp((1.0 - uv.y) * 0.6 + streak * 0.32 + n * 0.12, 0.0, 1.0);
    }
    if (style < 3.5) {
        // Ice: Voronoi shards, each falling away whole at its own moment.
        vec2 p = uv * vec2(3.2, 4.6) + seed;
        vec2 cell = floor(p);
        float d1 = 8.0;
        float d2 = 8.0;
        float id = 0.0;
        for (int y = -1; y <= 1; y++) {
            for (int x = -1; x <= 1; x++) {
                vec2 neighbour = cell + vec2(float(x), float(y));
                vec2 site = neighbour + cardDissolveHash2(neighbour);
                float d = length(site - p);
                if (d < d1) { d2 = d1; d1 = d; id = cardDissolveHash(neighbour + 0.37); }
                else if (d < d2) { d2 = d; }
            }
        }
        crack = 1.0 - smoothstep(0.0, 0.035, d2 - d1);
        return id * 0.9 + n * 0.1;
    }
    // Growth: opens from the heart of the card outward.
    vec2 c = (uv - 0.5) * vec2(0.74, 1.08) / 0.66;
    return clamp(length(c) * 1.25 + (n - 0.5) * 0.45, 0.0, 1.0);
}
`;

/** Where the dissolve stands at an amount: the field below it is gone. */
export const CARD_DISSOLVE_THRESHOLD_GLSL = 'uDissolve * 1.12 - 0.06';

const FRAGMENT_UNIFORMS = /* glsl */ `
varying vec2 vDissolveUv;
uniform vec2 uDissolveUvScale;
uniform float uDissolve;
uniform vec3 uDissolveEdge;
uniform float uDissolveStyle;
uniform vec2 uDissolveSeed;
`;

const FRAGMENT_APPLY = /* glsl */ `
if (uDissolve > 0.0) {
    float crack;
    float field = cardDissolveField(0.5 + (vDissolveUv - 0.5) * uDissolveUvScale, uDissolveStyle, uDissolveSeed, crack);
    float threshold = ${CARD_DISSOLVE_THRESHOLD_GLSL};
    if (field < threshold) discard;
    float ahead = field - threshold;
    vec3 surface = gl_FragColor.rgb;
    if (uDissolveStyle > 0.5 && uDissolveStyle < 1.5) {
        // Fire: the paper chars ahead of the flame, then the edge burns white-hot to orange.
        surface *= mix(0.22, 1.0, smoothstep(0.05, 0.24, ahead));
        float rim = 1.0 - smoothstep(0.0, 0.07, ahead);
        surface = mix(surface, uDissolveEdge * 2.6, rim);
        surface = mix(surface, vec3(1.0, 0.93, 0.75) * 2.2, 1.0 - smoothstep(0.0, 0.018, ahead));
    } else if (uDissolveStyle < 2.5 && uDissolveStyle > 1.5) {
        // Water: a soaked band, darker and bluer, under a soft bright meniscus.
        surface = mix(surface, surface * vec3(0.45, 0.66, 0.9), 1.0 - smoothstep(0.04, 0.26, ahead));
        surface = mix(surface, uDissolveEdge * 1.9, (1.0 - smoothstep(0.0, 0.11, ahead)) * 0.85);
    } else if (uDissolveStyle < 3.5 && uDissolveStyle > 2.5) {
        // Ice: cracks light up first, then a shard about to fall frosts over whole.
        surface = mix(surface, uDissolveEdge * 2.2, crack * 0.85 * smoothstep(0.0, 0.14, uDissolve));
        surface = mix(surface, uDissolveEdge * 1.7, (1.0 - smoothstep(0.0, 0.12, ahead)) * 0.8);
    } else if (uDissolveStyle > 3.5) {
        // Growth: a golden bloom ahead of a green living edge.
        float bloom = smoothstep(0.03, 0.08, ahead) * (1.0 - smoothstep(0.08, 0.24, ahead));
        surface = mix(surface, vec3(1.0, 0.86, 0.42) * 1.6, bloom * 0.55);
        surface = mix(surface, uDissolveEdge * 2.3, 1.0 - smoothstep(0.0, 0.06, ahead));
    } else {
        surface = mix(surface, uDissolveEdge * 2.4, 1.0 - smoothstep(0.0, 0.09, ahead));
    }
    gl_FragColor.rgb = surface;
}`;

type CardDissolveMaterial = MeshStandardMaterial | MeshBasicMaterial;

/** The material's dissolve uniforms, once installed. */
export const cardDissolveUniforms = (material: CardDissolveMaterial | null | undefined): CardDissolveUniforms | null =>
    (material?.userData?.[DISSOLVE_KEY] as CardDissolveUniforms | undefined) ?? null;

/**
 * Install the dissolve on a card surface material (idempotent). Pass the card's shared `uniforms`
 * so its surfaces and rim burn as one; a second call only updates the look. `uvScale` is a smaller
 * plane's size against the card's, so its uv lands where it sits on the card.
 */
export const installCardDissolve = (
    material: CardDissolveMaterial,
    suit: TileSuit | undefined,
    options: { uniforms?: CardDissolveUniforms; seed?: number; uvScale?: { x: number; y: number } } = {}
): void => {
    const existing = cardDissolveUniforms(material);
    if (existing) {
        setCardDissolveLook(existing, suit, options.seed ?? 0);
        return;
    }
    const uniforms = options.uniforms ?? createCardDissolveUniforms(suit, options.seed);
    if (options.uniforms) setCardDissolveLook(uniforms, suit, options.seed ?? 0);
    material.userData[DISSOLVE_KEY] = uniforms;
    const uvScale = { value: new Vector2(options.uvScale?.x ?? 1, options.uvScale?.y ?? 1) };
    material.customProgramCacheKey = () => DISSOLVE_KEY;
    material.onBeforeCompile = (shader) => {
        shader.uniforms.uDissolve = uniforms.uDissolve;
        shader.uniforms.uDissolveEdge = uniforms.uDissolveEdge;
        shader.uniforms.uDissolveStyle = uniforms.uDissolveStyle;
        shader.uniforms.uDissolveSeed = uniforms.uDissolveSeed;
        shader.uniforms.uDissolveUvScale = uvScale;
        shader.vertexShader = shader.vertexShader
            .replace('#include <common>', '#include <common>\nvarying vec2 vDissolveUv;')
            .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDissolveUv = uv;');
        shader.fragmentShader = shader.fragmentShader
            .replace('#include <common>', `#include <common>\n${FRAGMENT_UNIFORMS}${CARD_DISSOLVE_GLSL}`)
            .replace('#include <dithering_fragment>', `#include <dithering_fragment>\n${FRAGMENT_APPLY}`);
    };
    material.needsUpdate = true;
};

/** Set how far the card has burned away, 0 (whole) to 1 (gone). */
export const setCardDissolve = (material: CardDissolveMaterial | null | undefined, amount: number): void => {
    const uniforms = cardDissolveUniforms(material);
    if (!uniforms) return;
    const next = Math.min(1, Math.max(0, amount));
    if (uniforms.uDissolve.value !== next) uniforms.uDissolve.value = next;
};
