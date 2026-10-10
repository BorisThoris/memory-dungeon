import { Color, DoubleSide, Group, Mesh, NormalBlending, PlaneGeometry, ShaderMaterial, type Texture } from 'three';
import type { GraphicsQualityPreset, Tile, TileSuit } from '../../shared/contracts';
import { CARD_DISSOLVE_EDGE } from './cardDissolveMaterial';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { getCardFaceStaticTexture, getTileFaceOverlayTexture } from './tileTextures';
import { cardDepartureEffectBudget } from './cardDepartureBudget';
import { createDepartureSheet } from './cardDepartureSheet';
import type { DepartureBinding } from './cardDepartureWorld';

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
 * The card's own face follows an integrated soft body (`cardDepartureSheet.ts`). Nearby material
 * joins one particle/constraint simulation and surface (`cardDepartureWorld.ts`); there is no
 * independent flame or vine sheet per card. Ice and stone keep their textured pieces, driven by
 * the shared collision bodies. Every source fades within two and a half seconds.
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

// Position comes from the CPU soft-body solver. Shaders never prescribe motion.
const physicalVertex = `varying vec2 vUv;varying float vFall;varying float vPool;varying float vBurn;
uniform float uT;uniform float uFloor;
void main(){vUv=uv;vFall=max(0.,(uv.y-.5)*1.08-position.y);vPool=1.-smoothstep(0.,.06,position.y-uFloor);
vBurn=uT*.72-uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;

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
    alpha *= 1.0 - smoothstep(0.22, 0.8, uT);
    if (alpha < 0.02) discard;
    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ fire: the card combusts

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

interface Effect {
    start: number;
    duration: number;
    meshes: Mesh[];
    materials: ShaderMaterial[];
    overlay: Texture | null;
    sheet: ReturnType<typeof createDepartureSheet>;
    floor: number;
    binding?: () => DepartureBinding | undefined;
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
        effect.overlay?.dispose();
    };
    return {
        group,
        /** The card goes its element's way, `delay` seconds after `time`; returns false for an element that shatters instead. */
        spawn({ tile, x, y, z, seed, time, delay, floorY, quality, binding }: { tile: Tile; x: number; y: number; z: number; seed: number; time: number; delay: number; floorY: number; quality: GraphicsQualityPreset; binding?: () => DepartureBinding | undefined }): boolean {
            const kind = cardElementFxOf(tile.suit);
            if (!kind) return false;
            // A handled element must not fall back to shards when its detailed effect pool is full.
            if (effects.length >= cardDepartureEffectBudget(quality)) return true;
            const duration = CARD_ELEMENT_FX_SECONDS[kind];
            const face = getCardFaceStaticTexture();
            // The card window can evict its texture while this departure is still drawing.
            // A clone shares the canvas/source but gives the effect its own disposal lifetime.
            const overlay = getTileFaceOverlayTexture(tile, 'matched', quality)?.clone() ?? null;
            const tint = new Color(CARD_DISSOLVE_EDGE[tile.suit ?? 'none'] ?? '#ffd27a');
            const shared = {
                uT: { value: 0 },
                uSeed: { value: (seed % 997) / 97 },
                uTint: { value: tint },
                uDuration: { value: duration },
                uFloor: { value: floorY - y },
                uFace: { value: face },
                uOverlay: overlay ? { value: overlay } : BLANK,
                uHasOverlay: { value: overlay ? 1 : 0 }
            };
            const segments = quality === 'low' ? [4, 6] : [6, 8];
            const card = (vertexShader: string, fragmentShader: string): Mesh => {
                const material = new ShaderMaterial({ vertexShader, fragmentShader, uniforms: shared, side: DoubleSide, transparent: true, depthWrite: false, blending: NormalBlending });
                const mesh = new Mesh(new PlaneGeometry(CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT, segments[0], segments[1]), material);
                mesh.position.set(x, y, z + 0.012);
                return mesh;
            };
            const meshes: Mesh[] = [];
            meshes.push(card(physicalVertex, kind === 'liquefy' ? liquefyFragment : kind === 'combust' ? combustFragment : sproutFragment));
            const sheet = createDepartureSheet((meshes[0]!.geometry.attributes.position!.array as Float32Array), segments[0]!, segments[1]!,
                kind === 'liquefy' ? 'water' : kind === 'combust' ? 'fire' : 'growth', seed);
            for (const mesh of meshes) {
                mesh.renderOrder = 7;
                mesh.visible = false;
                mesh.frustumCulled = false;
                group.add(mesh);
            }
            effects.push({ start: time + delay, duration, meshes, materials: meshes.map((mesh) => mesh.material as ShaderMaterial), overlay, sheet, floor: floorY - y, binding });
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
                    effect.sheet.advance(t, effect.floor, effect.binding?.());
                    const attribute = effect.meshes[0]!.geometry.attributes.position!;
                    (attribute.array as Float32Array).set(effect.sheet.positions);
                    attribute.needsUpdate = true;
                    // The card's real face shades the integrated soft body.
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
