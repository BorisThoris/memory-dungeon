import { AdditiveBlending, Color, DoubleSide, Group, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, Vector2, type Texture } from 'three';
import type { GraphicsQualityPreset, Tile, TileSuit } from '../../shared/contracts';
import { CARD_DISSOLVE_EDGE } from './cardDissolveMaterial';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { getCardFaceStaticTexture, getTileFaceOverlayTexture } from './tileTextures';

/**
 * The card itself going its element's way when it leaves (2026-10-09, the owner: "a card should
 * physically liquidate, or combust into flames, or have a growth spurt"):
 *
 * - **water** liquefies: the card wobbles, then slumps under its own weight, column by column, the
 *   top running down over the bottom in drips, turning to water as it goes, and spreads into a
 *   puddle on the floor under the board that drains away;
 * - **fire** combusts: it catches at its foot and the burn climbs, the card charring and curling
 *   behind a glowing edge while a sheet of flame rises off that edge, until it is ash;
 * - **growth** has a growth spurt: the card swells, green veins race over its face, vines sprout
 *   out of its edges and leaf, and it crumbles into the foliage.
 *
 * Each is the card's own face, drawn again over the card as it leaves (it dissolves under it), on
 * a finely cut plane the vertex shader moves. Ice still shatters into glass and a card with no
 * element into stone (`cardShardSystem.ts`). Short (under two and a half seconds) and kept to the
 * card's own cell, its floor and a little around it.
 */
export type CardElementFx = 'liquefy' | 'combust' | 'sprout';

export const cardElementFxOf = (suit: TileSuit | undefined | null): CardElementFx | null =>
    suit === 'tide' ? 'liquefy' : suit === 'ember' ? 'combust' : suit === 'moss' ? 'sprout' : null;

/** Seconds each lasts. */
export const CARD_ELEMENT_FX_SECONDS: Readonly<Record<CardElementFx, number>> = { liquefy: 2.2, combust: 2.4, sprout: 2.3 };

const COMMON = `
varying vec2 vUv;
uniform float uT;
uniform float uSeed;
float hash1(float n) { return fract(sin(n * 91.3458 + uSeed) * 47453.5453); }
float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453); }
float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash2(i), hash2(i + vec2(1, 0)), f.x), mix(hash2(i + vec2(0, 1)), hash2(i + vec2(1, 1)), f.x), f.y);
}
float fbm(vec2 p) { return 0.55 * noise(p) + 0.3 * noise(p * 2.1 + 3.1) + 0.15 * noise(p * 4.3 + 7.7); }
`;

const FACE = `
uniform sampler2D uFace;
uniform sampler2D uOverlay;
uniform float uHasOverlay;
vec4 cardFace(vec2 uv) {
    vec4 colour = texture2D(uFace, uv);
    vec4 art = texture2D(uOverlay, uv);
    colour.rgb = mix(colour.rgb, art.rgb, art.a * uHasOverlay);
    colour.a = max(colour.a, art.a * uHasOverlay);
    return colour;
}
`;

// ------------------------------------------------------------------ water: the card liquefies

const liquefyVertex = `${COMMON}
uniform float uFloor;
uniform vec2 uCard;
varying float vFall;
varying float vPool;
void main() {
    vUv = uv;
    vec3 p = position;
    // Each run of the card lets go on its own beat, varying smoothly across it: a stepped beat per
    // column tore the mesh's triangles into spikes where one straddled two columns.
    float lag = noise(vec2(uv.x * 9.0, uSeed)) * 0.28;
    // A wobble first, as it loses its shape.
    float soft = smoothstep(0.0, 0.25, uT);
    p.x += sin(uv.y * 11.0 + uT * 13.0) * 0.012 * soft * (1.0 - uv.y * 0.3);
    // Then it slumps: each column lets go on its own beat, the top falling furthest, so it runs down in drips.
    float t = max(0.0, uT - 0.18 - lag - (1.0 - uv.y) * 0.12);
    float fall = 4.8 * t * t * (0.35 + 0.65 * uv.y) + 0.12 * t;
    p.y -= fall;
    // What reaches the floor spreads out over it, but only so far: a puddle about the card's width
    // each side (the fall is unbounded, and spreading by all of it ran a sheet across the screen).
    float under = max(0.0, uFloor - p.y);
    float spread = uCard.x * 0.75 * (1.0 - exp(-under * 2.2));
    p.y = max(p.y, uFloor + 0.004 * sin(p.x * 30.0 + uT * 7.0));
    p.x += sign(p.x + 0.0001) * spread;
    p.z -= min(under, 0.4) * 0.04;
    vFall = fall;
    vPool = smoothstep(0.0, 0.05, under);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const liquefyFragment = `${COMMON}${FACE}
uniform vec3 uTint;
uniform float uDuration;
varying float vFall;
varying float vPool;
void main() {
    vec4 colour = cardFace(vUv);
    float wet = smoothstep(0.05, 0.6, uT);
    // Turning to water: the face clears and blues, a light running down it.
    vec3 water = vec3(0.12, 0.38, 0.6);
    vec3 rgb = mix(colour.rgb, water, wet * (0.45 + 0.4 * smoothstep(0.0, 0.4, vFall)));
    float sheen = smoothstep(0.7, 1.0, sin(vUv.y * 30.0 + uT * 9.0 + vUv.x * 6.0));
    rgb += vec3(0.6, 0.85, 1.0) * sheen * 0.3 * wet + uTint * 0.15 * wet;
    // Stretched, it is drips: only the middle of each column holds.
    float columnX = fract(vUv.x * 16.0);
    float stretched = smoothstep(0.15, 0.6, vFall) * (1.0 - vPool);
    float drip = mix(1.0, smoothstep(0.5, 0.18, abs(columnX - 0.5)), stretched);
    float alpha = colour.a * drip * (1.0 - 0.35 * wet);
    // The puddle thins and drains away.
    alpha *= 1.0 - smoothstep(uDuration - 0.9, uDuration, uT + vPool * 0.2);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ fire: the card combusts

const combustVertex = `${COMMON}
// The burn line: climbing with time, ragged across the card and wavering, never a straight bar.
float burnFront(float u) { return uT * 0.72 - 0.06 + (fbm(vec2(u * 3.4 + 2.0, uT * 0.9)) - 0.5) * 0.26 + (noise(vec2(u * 11.0, uT * 2.0)) - 0.5) * 0.05; }
varying float vBurn;
void main() {
    vUv = uv;
    vec3 p = position;
    float front = burnFront(uv.x);
    // Burnt, it curls back away from the flame.
    float burnt = clamp((front - uv.y) * 3.0, 0.0, 1.0);
    p.z -= burnt * burnt * 0.22;
    p.y += burnt * 0.04;
    p.x *= 1.0 - burnt * 0.08;
    vBurn = front - uv.y;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const combustFragment = `${COMMON}${FACE}
// The burn line: climbing with time, ragged across the card and wavering, never a straight bar.
float burnFront(float u) { return uT * 0.72 - 0.06 + (fbm(vec2(u * 3.4 + 2.0, uT * 0.9)) - 0.5) * 0.26 + (noise(vec2(u * 11.0, uT * 2.0)) - 0.5) * 0.05; }
uniform vec3 uTint;
varying float vBurn;
void main() {
    vec4 colour = cardFace(vUv);
    float n = fbm(vUv * vec2(7.0, 9.0)) - 0.5;
    // Per pixel, so the line is as ragged as the fbm and not the mesh's resolution.
    float d = burnFront(vUv.x) - vUv.y + n * 0.1;
    // Ahead of the fire it scorches brown; behind the glowing edge it is char, then ash and gone.
    vec3 rgb = colour.rgb;
    rgb = mix(rgb, rgb * vec3(0.55, 0.35, 0.2), smoothstep(-0.18, 0.0, d));
    rgb = mix(rgb, vec3(0.06, 0.04, 0.03), smoothstep(0.0, 0.06, d));
    float edge = exp(-pow(d, 2.0) / 0.0012) * (0.7 + 0.6 * noise(vec2(vUv.x * 30.0, uT * 8.0)));
    rgb += mix(uTint, vec3(1.0, 0.7, 0.3), 0.5) * edge * 1.9;
    float alpha = colour.a * (1.0 - smoothstep(0.12, 0.2, d));
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
}`;

/** The sheet of flame off the burning edge: a quad over the card and above it, drawn added. */
const flameVertex = `${COMMON}
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const flameFragment = `${COMMON}
// The burn line: climbing with time, ragged across the card and wavering, never a straight bar.
float burnFront(float u) { return uT * 0.72 - 0.06 + (fbm(vec2(u * 3.4 + 2.0, uT * 0.9)) - 0.5) * 0.26 + (noise(vec2(u * 11.0, uT * 2.0)) - 0.5) * 0.05; }
uniform vec3 uTint;
uniform float uDuration;
uniform vec2 uCard;
void main() {
    // The quad is the card's width and a fifth again, and 1.6 of its height: the card fills 0..1 of y.
    vec2 p = vec2((vUv.x - 0.5) * 1.2, vUv.y * 1.6);
    float front = burnFront(p.x + 0.5);
    float above = p.y - front;
    float span = 1.0 - smoothstep(0.44, 0.56, abs(p.x));
    // Rising turbulence bends the flames; tongues are noise stretched upward and drawn up fast.
    float warp = (fbm(vec2(p.x * 3.0, p.y * 2.0 - uT * 2.6)) - 0.5) * 0.28;
    float px = p.x + warp;
    float tongues = fbm(vec2(px * 6.5, p.y * 1.4 - uT * 4.2));
    float height = 0.45 + 0.55 * fbm(vec2(px * 2.6 + 5.0, uT * 1.4));
    float k = clamp(1.0 - above / height, 0.0, 1.0);
    float flame = smoothstep(-0.06, 0.03, above + (noise(vec2(px * 9.0, uT * 5.0)) - 0.5) * 0.05) * pow(k, 0.8) * smoothstep(0.44, 0.8, tongues + k * 0.16) * span;
    // Gaps between the tongues reach down to the root, so the base is flames and never a solid bar.
    flame *= 0.35 + 0.65 * smoothstep(0.3, 0.62, noise(vec2(px * 7.5 + 3.0, uT * 3.0)));
    // On the char below the edge, small flames still flicker.
    float flicker = (1.0 - smoothstep(-0.3, 0.0, above)) * step(above, 0.0) * smoothstep(0.62, 0.9, noise(vec2(px * 14.0, p.y * 9.0 - uT * 6.0))) * 0.55 * span;
    flame = max(flame, flicker);
    float life = smoothstep(0.0, 0.12, uT) * (1.0 - smoothstep(uDuration - 0.5, uDuration, uT));
    // Deep red at the tips, orange in the body, yellow at the root: never blown out to white.
    vec3 colour = mix(vec3(0.5, 0.07, 0.02), vec3(1.0, 0.42, 0.07) * mix(vec3(1.0), uTint * 1.4, 0.25), smoothstep(0.08, 0.5, flame));
    colour = mix(colour, vec3(1.0, 0.8, 0.32), smoothstep(0.55, 0.95, flame));
    float alpha = flame * life * 0.8;
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(colour * alpha, alpha);
    #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ growth: the card has a growth spurt

const sproutVertex = `${COMMON}
void main() {
    vUv = uv;
    vec3 p = position;
    // The spurt: it swells, overshoots and settles, swaying as it grows.
    float spurt = smoothstep(0.0, 0.35, uT) * (1.0 + 0.25 * sin(uT * 9.0) * exp(-uT * 3.0));
    p.xy *= 1.0 + 0.14 * spurt;
    p.x += sin(uv.y * 4.0 + uT * 5.0) * 0.012 * spurt;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}`;

const sproutFragment = `${COMMON}${FACE}
uniform vec3 uTint;
uniform float uDuration;
void main() {
    vec4 colour = cardFace(vUv);
    // Veins racing over the face from its edges: ridged noise, more of it as it grows.
    float edgeDist = min(min(vUv.x, 1.0 - vUv.x), min(vUv.y, 1.0 - vUv.y));
    float vein = 1.0 - abs(fbm(vUv * 6.0 + vec2(0.0, uT * 0.3)) * 2.0 - 1.0);
    float reach = smoothstep(0.1, 1.2, uT) * 0.55;
    float veins = smoothstep(0.86, 0.97, vein) * step(edgeDist, reach + 0.05);
    vec3 green = vec3(0.24, 0.52, 0.16);
    vec3 rgb = mix(colour.rgb, green * 1.3 + uTint * 0.2, veins);
    rgb = mix(rgb, green, smoothstep(0.9, uDuration - 0.4, uT) * 0.55);
    // It crumbles into the foliage from the edges at the end.
    float crumble = smoothstep(uDuration - 0.9, uDuration, uT + (0.5 - edgeDist) * 0.6 + (fbm(vUv * 14.0) - 0.5) * 0.4);
    float alpha = colour.a * (1.0 - crumble);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
}`;

/** The vines out of the card's edges: a quad twice the card around it; inside the card it shows nothing. */
const vineFragment = `${COMMON}
uniform vec3 uTint;
uniform float uDuration;
uniform vec2 uCard;
vec2 rot(vec2 v, float a) { float c = cos(a), s = sin(a); return vec2(c * v.x - s * v.y, s * v.x + c * v.y); }
void main() {
    // The quad is twice the card's width and 1.7 its height, centred on it, in the card's own units.
    vec2 p = (vUv - 0.5) * vec2(uCard.x * 2.0, uCard.y * 1.7);
    vec2 h = uCard * 0.5;
    float grow = smoothstep(0.15, 1.1, uT);
    float stems = 0.0;
    float leaves = 0.0;
    float rib = 0.0;
    // Six vines leave the card's edges at seeded places, curling as they grow.
    for (int i = 0; i < 6; i++) {
        float fi = float(i);
        float side = mod(fi, 4.0);
        float along = hash1(fi * 3.1 + 1.0) * 1.6 - 0.8;
        vec2 origin = side < 1.0 ? vec2(-h.x, along * h.y) : side < 2.0 ? vec2(h.x, along * h.y) : side < 3.0 ? vec2(along * h.x, h.y) : vec2(along * h.x, -h.y);
        vec2 out_ = side < 1.0 ? vec2(-1.0, 0.0) : side < 2.0 ? vec2(1.0, 0.0) : side < 3.0 ? vec2(0.0, 1.0) : vec2(0.0, -1.0);
        vec2 dir = normalize(rot(out_, (hash1(fi * 5.7 + 2.0) - 0.5) * 1.1));
        vec2 perp = vec2(-dir.y, dir.x);
        float len = grow * (0.26 + 0.16 * hash1(fi * 2.3 + 4.0));
        float phase = hash1(fi * 7.9) * 6.283;
        vec2 q = p - origin;
        float s = dot(q, dir);
        float curl = 0.045 * sin(s * 16.0 + phase) * smoothstep(0.0, 0.08, s);
        float lateral = dot(q, perp) - curl;
        // The stem: thick at its root, a thread at its tip.
        float width = mix(0.017, 0.004, clamp(s / max(len, 1e-3), 0.0, 1.0));
        float on = step(0.0, s) * step(s, len);
        stems = max(stems, on * (1.0 - smoothstep(width * 0.5, width, abs(lateral))));
        // Leaves in pairs along it, unfurling behind the tip.
        for (int k = 1; k <= 3; k++) {
            float sk = len * float(k) / 3.6;
            float open = smoothstep(sk + 0.01, sk + 0.06, len);
            for (int f = 0; f < 2; f++) {
                float flip = f == 0 ? 1.0 : -1.0;
                vec2 centre = origin + dir * sk + perp * (0.045 * sin(sk * 16.0 + phase) + flip * 0.03 * open);
                vec2 lq = rot(p - centre, -(atan(dir.y, dir.x) + flip * 0.9));
                vec2 size = vec2(0.038, 0.017) * open;
                float leaf = 1.0 - smoothstep(0.75, 1.0, length(lq / max(size, vec2(1e-4))));
                leaves = max(leaves, leaf * open);
                rib = max(rib, leaf * (1.0 - smoothstep(0.0, 0.0018, abs(lq.y))));
            }
        }
    }
    // Nothing over the card itself: it is growing them.
    float outside = step(h.x, abs(p.x)) + step(h.y, abs(p.y));
    float life = 1.0 - smoothstep(uDuration - 0.7, uDuration, uT);
    vec3 stemColour = vec3(0.17, 0.3, 0.1);
    vec3 leafColour = mix(vec3(0.26, 0.52, 0.16), vec3(0.45, 0.72, 0.26) + uTint * 0.1, 0.5 + 0.5 * sin(p.x * 40.0 + p.y * 30.0));
    vec3 rgb = mix(stemColour, leafColour, leaves);
    rgb = mix(rgb, stemColour * 0.8, rib * 0.7);
    float alpha = max(stems, leaves) * min(outside, 1.0) * life;
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
}`;

interface Effect {
    start: number;
    duration: number;
    meshes: Mesh[];
    materials: ShaderMaterial[];
}

const BLANK = { value: null as Texture | null };

export const createCardElementFxSystem = () => {
    const group = new Group();
    group.name = 'card-element-fx';
    const effects: Effect[] = [];
    const drop = (effect: Effect): void => {
        for (const mesh of effect.meshes) {
            group.remove(mesh);
            mesh.geometry.dispose();
        }
        for (const material of effect.materials) material.dispose();
    };
    return {
        group,
        /** The card goes its element's way, `delay` seconds after `time`; returns false for an element that shatters instead. */
        spawn({ tile, x, y, z, seed, time, delay, floorY, quality }: { tile: Tile; x: number; y: number; z: number; seed: number; time: number; delay: number; floorY: number; quality: GraphicsQualityPreset }): boolean {
            const kind = cardElementFxOf(tile.suit);
            if (!kind) return false;
            const duration = CARD_ELEMENT_FX_SECONDS[kind];
            const face = getCardFaceStaticTexture();
            const overlay = getTileFaceOverlayTexture(tile, 'matched', quality);
            const tint = new Color(CARD_DISSOLVE_EDGE[tile.suit ?? 'none'] ?? '#ffd27a');
            const shared = {
                uT: { value: 0 },
                uSeed: { value: (seed % 997) / 97 },
                uTint: { value: tint },
                uDuration: { value: duration },
                uCard: { value: new Vector2(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT) },
                uFloor: { value: floorY - y },
                uFace: { value: face },
                uOverlay: overlay ? { value: overlay } : BLANK,
                uHasOverlay: { value: overlay ? 1 : 0 }
            };
            const segments = quality === 'low' ? [12, 16] : [24, 34];
            const card = (vertexShader: string, fragmentShader: string): Mesh => {
                const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms: shared, side: DoubleSide, transparent: true, depthWrite: false, blending: NormalBlending });
                const mesh = new Mesh(new PlaneGeometry(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT, segments[0], segments[1]), material);
                mesh.position.set(x, y, z + 0.012);
                return mesh;
            };
            const meshes: Mesh[] = [];
            if (kind === 'liquefy') {
                meshes.push(card(liquefyVertex, liquefyFragment));
            } else if (kind === 'combust') {
                meshes.push(card(combustVertex, combustFragment));
                const flames = new Mesh(
                    new PlaneGeometry(CARD_PLANE_WIDTH * 1.2, CARD_PLANE_HEIGHT * 1.6),
                    new ShaderMaterial({ vertexShader: flameVertex, fragmentShader: flameFragment, uniforms: shared, transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide })
                );
                // Its foot at the card's foot, rising a card's height again above.
                flames.position.set(x, y - CARD_PLANE_HEIGHT / 2 + (CARD_PLANE_HEIGHT * 1.6) / 2, z + 0.02);
                meshes.push(flames);
            } else {
                meshes.push(card(sproutVertex, sproutFragment));
                const vines = new Mesh(
                    new PlaneGeometry(CARD_PLANE_WIDTH * 2, CARD_PLANE_HEIGHT * 1.7),
                    new ShaderMaterial({ vertexShader: flameVertex, fragmentShader: vineFragment, uniforms: shared, transparent: true, depthWrite: false, side: DoubleSide })
                );
                vines.position.set(x, y, z + 0.006);
                meshes.push(vines);
            }
            for (const mesh of meshes) {
                mesh.renderOrder = 7;
                mesh.visible = false;
                mesh.frustumCulled = false;
                group.add(mesh);
            }
            effects.push({ start: time + delay, duration, meshes, materials: meshes.map((mesh) => mesh.material as ShaderMaterial) });
            return true;
        },
        advance(now: number): number {
            let live = 0;
            for (let index = effects.length - 1; index >= 0; index -= 1) {
                const effect = effects[index]!;
                const t = now - effect.start;
                if (t > effect.duration) {
                    drop(effect);
                    effects.splice(index, 1);
                    continue;
                }
                const showing = t >= 0;
                for (const mesh of effect.meshes) mesh.visible = showing;
                if (showing) {
                    // The uniforms are shared by the effect's meshes.
                    (effect.materials[0]!.uniforms.uT!).value = t;
                    live += 1;
                }
            }
            return live;
        },
        clear(): void {
            for (const effect of effects) drop(effect);
            effects.length = 0;
        },
        dispose(): void {
            this.clear();
        }
    };
};

export type CardElementFxSystem = ReturnType<typeof createCardElementFxSystem>;
