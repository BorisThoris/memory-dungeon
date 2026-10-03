import {
    BufferAttribute, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
    Mesh, NormalBlending, ShaderMaterial, Vector3, type Matrix4
} from 'three';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { createMulberry32 } from '../../shared/rng';
import { noopMeshRaycast } from './tileBoardPick';
import { sampleCardRim, type RimParticleMood } from './boardParticleRim';
import { buildLightningPath, comboArcTint } from './boardGroupArcs';

export type BoardParticleKind = 'bomb' | 'match' | 'flip' | 'chain' | 'rim' | 'ripple' | 'arc' | 'ember';
/** Room for a Fever break's bolts on top of its bursts: an arc is a few dozen segment quads. */
export const BOARD_PARTICLE_CAPACITY = 640;
export const boardParticleBudget = (quality: GraphicsQualityPreset): number =>
    quality === 'low' ? 128 : quality === 'medium' ? 320 : BOARD_PARTICLE_CAPACITY;

/** One lightning bolt between two points on the board, scaled by the combo. */
export interface BoardArcBurst {
    from: { x: number; y: number; z: number };
    to: { x: number; y: number; z: number };
    seed: number;
    time: number;
    delay?: number;
    /** 0..1, from `comboEffectIntensity`: strands, forks, width, life and colour all read it. */
    intensity: number;
    reduceMotion: boolean;
    quality: GraphicsQualityPreset;
    /** The bolt's colour; the ember palette's by intensity when omitted. */
    tint?: string;
    /** Strands past the three the intensity buys: the ascensions' (`comboSurge`), clamped by quality. */
    extraStrands?: number;
}

export interface BoardParticleBurst {
    kind: BoardParticleKind;
    x: number;
    y: number;
    z: number;
    seed: number;
    time: number;
    delay?: number;
    reduceMotion: boolean;
    quality: GraphicsQualityPreset;
    /** Local card transform within the board group, including tilt, flip, and departure scale. */
    cardMatrix?: Matrix4;
    energy?: number;
    rimMood?: RimParticleMood;
    /** Ember colour, for the combo heat's palette; the warm default otherwise. */
    tint?: string;
    /** How an ember moves: up like a spark from a fire, down like snow, or out like a static spark. */
    emberMode?: 'rise' | 'fall' | 'spark';
    /** An ember's size against the combo's sparks: the realm's snow, drops and leaves are bigger (`realmParticles.ts`). */
    sizeScale?: number;
    /**
     * An ember drawn as its element's own material (`elementCardMote`): a flame tongue licking up, a
     * drop of liquid that beads and falls, a shard of ice that glints, a leaf that tumbles. It moves
     * as its material does, whatever `emberMode` says.
     */
    shape?: BoardParticleShape;
    placement?: 'edge' | 'ground';
}

export type BoardParticleShape = 'flame' | 'droplet' | 'shard' | 'leaf';
/** The shader's kind code for each shape, after the bolt's seven. */
export const BOARD_PARTICLE_SHAPE_KIND: Readonly<Record<BoardParticleShape, number>> = { flame: 8, droplet: 9, shard: 10, leaf: 11 };

const vertexShader = `
    attribute vec3 origin;
    attribute vec4 movement;
    attribute vec4 lifetime;
    attribute vec3 tint;
    attribute vec2 rotation;
    uniform float time;
    uniform float rippleLayer;
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vAge;
    varying float vKind;
    void main() {
        float seconds = time - lifetime.x;
        float age = seconds / max(0.001, lifetime.y);
        vUv = uv; vTint = tint; vAge = age; vKind = lifetime.w;
        bool ripple = vKind > 5.5 && vKind < 6.5;
        if ((ripple && rippleLayer < 0.5) || (!ripple && rippleLayer > 0.5) || lifetime.y <= 0.0 || age < 0.0 || age >= 1.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
        }
        if (vKind > 6.5 && vKind < 7.5) {
            // A bolt segment: a fixed quad from one path point to the next, length by width.
            vec2 segment = vec2(position.x * lifetime.z, position.y * movement.z);
            segment = mat2(cos(rotation.x), sin(rotation.x), -sin(rotation.x), cos(rotation.x)) * segment;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(origin + vec3(segment, 0.0), 1.0);
            return;
        }
        float travel = (1.0 - exp(-movement.w * seconds)) / max(movement.w, 0.001);
        vec3 center = origin + vec3(movement.xy * travel, 0.0);
        center.y -= movement.z * seconds * seconds * 0.5;
        // Material-specific drift, anchored at birth (no sideways teleport on spawn).
        if (vKind > 7.5 && vKind < 8.5) center.x += sin(seconds * 9.0 + origin.x * 13.0) * seconds * 0.035;
        if (vKind > 10.5) center.x += (sin(seconds * 3.5 + rotation.x) - sin(rotation.x)) * 0.09;
        float scale = lifetime.z * mix(1.0, 0.22, age);
        if (vKind > 0.5 && vKind < 1.5) scale = lifetime.z * mix(0.45, 2.1, age);
        if (vKind > 1.5 && vKind < 2.5) scale = lifetime.z * mix(0.5, 1.5, age);
        if (vKind > 2.5 && vKind < 3.5) scale = lifetime.z;
        if (vKind > 3.5) scale = lifetime.z * mix(1.0, 0.35, age);
        // The elements: a flame thins as it climbs, a drop and a shard keep their size, a leaf too.
        if (vKind > 7.5 && vKind < 8.5) scale = lifetime.z * mix(1.15, 0.5, age);
        if (vKind > 8.5) scale = lifetime.z;
        if (ripple) scale = lifetime.z * mix(0.3, 1.0, 1.0 - pow(1.0 - age, 3.0));
        float angle = rotation.x + rotation.y * seconds;
        vec2 local = position.xy * scale;
        if (vKind < 0.5) local.y *= 2.2;
        if (vKind > 7.5 && vKind < 8.5) local.y *= 1.9;
        // A drop stretches as it falls.
        if (vKind > 8.5 && vKind < 9.5) local.y *= 1.25 + min(0.9, movement.z * seconds * 0.9);
        if (vKind > 9.5 && vKind < 10.5) local.y *= 1.5;
        // A leaf rolls in the air, presenting its broad side and then its thin edge.
        if (vKind > 10.5) local.x *= 0.35 + 0.65 * abs(cos(seconds * 3.0 + rotation.x));
        if (ripple) local.y *= 0.72;
        local = mat2(cos(angle), -sin(angle), sin(angle), cos(angle)) * local;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(center + vec3(local, 0.0), 1.0);
    }
`;
const fragmentShader = `
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vAge;
    varying float vKind;
    uniform float time;
    void main() {
        if (vAge < 0.0 || vAge >= 1.0) discard;
        vec2 p = vUv * 2.0 - 1.0;
        float radius = length(p);
        float shape = pow(max(0.0, 1.0 - radius), 2.0);
        float strength = 0.9;
        vec3 color = vTint;
        if (vKind > 0.5 && vKind < 1.5) {
            shape = 1.0 - smoothstep(0.035, 0.1, abs(radius - 0.72));
            strength = 0.58;
        }
        if (vKind > 1.5 && vKind < 2.5) { shape = pow(max(0.0, 1.0 - radius), 1.6); strength = 0.32; }
        if (vKind > 2.5 && vKind < 3.5) { shape = 1.0 - smoothstep(0.05, 0.2, abs(radius - 0.7)); strength = 0.3; }
        if (vKind > 3.5 && vKind < 5.5) {
            float core = exp(-radius * radius * 18.0);
            float rays = exp(-abs(p.x * p.y) * 55.0) * pow(max(0.0, 1.0 - radius), 2.0);
            shape = core + rays * 0.6;
            strength = 1.0;
        }
        if (vKind > 6.5 && vKind < 7.5) {
            float d = abs(vUv.y * 2.0 - 1.0);
            float core = exp(-d * d * 28.0);
            float glow = exp(-d * d * 3.0) * 0.6;
            // Lightning strobes: each bolt strobes on a beat keyed to its tint.
            float beat = fract(sin(floor(vAge * 20.0) * 12.9898 + vTint.g * 78.233) * 43758.5453);
            shape = (core + glow) * (0.55 + 0.45 * step(0.3, beat));
            strength = 1.0;
            color = mix(vTint, vec3(1.0), core * 0.7);
        }
        if (vKind > 5.5 && vKind < 6.5) {
            float band = abs(radius - 0.76);
            shape = exp(-band * band * 1800.0) + exp(-band * band * 110.0) * 0.3;
            strength = 0.72;
        }
        if (vKind > 7.5 && vKind < 8.5) {
            // Fire: a tongue, wide at the foot and pointed at the tip, that wavers; white-hot in
            // the core, its own colour in the body, red at the tip.
            float up = p.y * 0.5 + 0.5;
            float sway = sin(p.y * 5.0 + time * 13.0 + vTint.g * 40.0) * 0.16 * up;
            float d = length(vec2((p.x + sway) * (1.25 + 2.4 * up * up), p.y * 0.92 + 0.08));
            shape = smoothstep(1.0, 0.35, d);
            float core = smoothstep(0.55, 0.0, d + up * 0.35);
            color = mix(mix(vTint, vec3(0.9, 0.16, 0.04), up * 0.7), vec3(1.0, 0.95, 0.75), core);
            strength = 0.95;
        }
        if (vKind > 8.5 && vKind < 9.5) {
            // Liquid: a drop with a round belly and a drawn-out neck, a hard edge, a dark rim where
            // the light bends, and one bright highlight.
            float neck = max(0.0, p.y);
            float d = length(vec2(p.x * (1.15 + 1.7 * neck * neck), p.y * 0.95 + 0.05));
            shape = smoothstep(0.95, 0.82, d);
            float rim = smoothstep(0.45, 0.9, d);
            float highlight = exp(-dot(p - vec2(-0.28, -0.22), p - vec2(-0.28, -0.22)) * 22.0);
            float caustic = 0.5 + 0.5 * sin(p.x * 7.0 + p.y * 5.0 + time * 5.0 + vTint.b * 30.0);
            color = mix(vTint * (0.85 + 0.25 * caustic), vTint * 0.45, rim) + vec3(highlight);
            strength = 0.88;
        }
        if (vKind > 9.5 && vKind < 10.5) {
            // Ice: a cut crystal, hard-edged, each facet its own brightness, with a glint that comes and goes.
            float d = abs(p.x) * 1.7 + abs(p.y);
            shape = smoothstep(1.0, 0.92, d);
            float facet = 0.62 + 0.2 * step(0.0, p.x) + 0.18 * step(0.0, p.y * p.x);
            float glint = pow(max(0.0, sin(time * 4.0 + vTint.r * 60.0 + p.y * 3.0)), 10.0);
            float spine = exp(-abs(p.x) * 26.0) * 0.5;
            color = mix(vTint * facet, vec3(1.0), spine + glint * 0.8);
            strength = 0.9;
        }
        if (vKind > 10.5) {
            // Growth: a leaf, two arcs meeting at a point, with a midrib and a lighter side.
            float blade = abs(p.x) - (1.0 - p.y * p.y) * 0.5;
            shape = smoothstep(0.04, -0.06, blade);
            float midrib = exp(-abs(p.x) * 30.0) * 0.45;
            color = vTint * (0.78 + 0.3 * step(0.0, p.x)) - vec3(midrib * 0.35);
            strength = 0.92;
        }
        float fade = smoothstep(0.0, 0.06, vAge) * pow(1.0 - vAge, 1.5);
        float alpha = shape * fade * strength;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(color, alpha);
        #include <colorspace_fragment>
    }
`;

/** One fixed set of instance buffers, two layers; emission never creates a mesh or material. */
export const createBoardParticleSystem = () => {
    const geometry = new InstancedBufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(new Float32Array([
        -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0
    ]), 3));
    geometry.setAttribute('uv', new BufferAttribute(new Float32Array([0, 0, 1, 0, 1, 1, 0, 1]), 2));
    geometry.setIndex([0, 1, 2, 0, 2, 3]);
    const attribute = (name: string, width: number) => {
        const value = new InstancedBufferAttribute(new Float32Array(BOARD_PARTICLE_CAPACITY * width), width);
        value.setUsage(DynamicDrawUsage);
        geometry.setAttribute(name, value);
        return value;
    };
    const origin = attribute('origin', 3);
    const movement = attribute('movement', 4);
    const lifetime = attribute('lifetime', 4);
    const tint = attribute('tint', 3);
    const rotation = attribute('rotation', 2);
    const attributes = [origin, movement, lifetime, tint, rotation];
    geometry.instanceCount = BOARD_PARTICLE_CAPACITY;
    const material = new ShaderMaterial({
        vertexShader, fragmentShader, uniforms: { time: { value: 0 }, rippleLayer: { value: 0 } },
        transparent: true, depthWrite: false, depthTest: false, toneMapped: false, blending: NormalBlending
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'board-particles';
    mesh.frustumCulled = false;
    mesh.raycast = noopMeshRaycast;
    mesh.renderOrder = 100;
    mesh.visible = false;
    // The same instance buffers render contact rings below card chrome, sparks above it.
    const rippleMaterial = material.clone();
    rippleMaterial.uniforms.rippleLayer.value = 1;
    const rippleMesh = new Mesh(geometry, rippleMaterial);
    rippleMesh.name = 'board-contact-ripples';
    rippleMesh.frustumCulled = false;
    rippleMesh.raycast = noopMeshRaycast;
    rippleMesh.renderOrder = -5;
    rippleMesh.visible = false;
    const ends = new Float32Array(BOARD_PARTICLE_CAPACITY);
    const comboPopSlots = new Uint8Array(BOARD_PARTICLE_CAPACITY);
    let comboPopEffects = true;
    const color = new Color();
    const point = new Vector3();
    const direction = new Vector3();
    const rimSample = { x: 0, y: 0, nx: 0, ny: 0 };
    let cursor = 0;
    let budget = BOARD_PARTICLE_CAPACITY;
    const arcColor = new Color();
    /** The next slot a one-shot effect may take: never a contact ring that is still showing. */
    const claimSlot = (time: number): number | null => {
        let checked = 0;
        while (ends[cursor % budget]! > time && lifetime.getW(cursor % budget) === 6 && checked++ < budget) cursor += 1;
        return checked >= budget ? null : cursor++ % budget;
    };
    /** One bolt segment from (ax, ay) to (bx, by). */
    const writeSegment = (slot: number, ax: number, ay: number, bx: number, by: number, z: number,
        width: number, start: number, life: number): void => {
        const length = Math.hypot(bx - ax, by - ay);
        origin.setXYZ(slot, (ax + bx) / 2, (ay + by) / 2, z);
        // Overlap the joints a little so a bent bolt reads as one line, not a dotted one.
        movement.setXYZW(slot, 0, 0, width, 1);
        lifetime.setXYZW(slot, start, life, length * 1.12 + width * 0.5, 7);
        tint.setXYZ(slot, arcColor.r, arcColor.g, arcColor.b);
        rotation.setXY(slot, Math.atan2(by - ay, bx - ax), 0);
        ends[slot] = start + life;
        comboPopSlots[slot] = 1;
    };

    const clear = (): void => {
        ends.fill(0);
        comboPopSlots.fill(0);
        lifetime.array.fill(0);
        lifetime.needsUpdate = true;
        cursor = 0;
        mesh.visible = false;
        rippleMesh.visible = false;
    };
    const configure = (quality: GraphicsQualityPreset): void => {
        const nextBudget = boardParticleBudget(quality);
        if (nextBudget !== budget) { clear(); budget = nextBudget; }
        geometry.instanceCount = budget;
    };
    return {
        mesh,
        rippleMesh,
        clear,
        configure,
        setComboPopEffects(enabled: boolean): void {
            comboPopEffects = enabled;
            if (enabled) return;
            // Remove pending and active pop particles without clearing elemental or input feedback.
            for (let slot = 0; slot < budget; slot += 1) {
                if (!comboPopSlots[slot]) continue;
                ends[slot] = 0;
                lifetime.setXYZW(slot, 0, 0, 0, 0);
                comboPopSlots[slot] = 0;
            }
            lifetime.needsUpdate = true;
        },
        emit(burst: BoardParticleBurst): number {
            const pop = burst.kind === 'match' || burst.kind === 'chain' || burst.kind === 'ripple'
                || (burst.kind === 'rim' && burst.rimMood === 'match');
            if (pop && !comboPopEffects) return 0;
            configure(burst.quality);
            const rng = createMulberry32(burst.seed);
            const bomb = burst.kind === 'bomb';
            const flip = burst.kind === 'flip';
            const rim = burst.kind === 'rim';
            const ripple = burst.kind === 'ripple';
            // Ambient embers rising off a card while the combo burns: free slots only, like the rim.
            const ember = burst.kind === 'ember';
            const edge = rim || burst.kind === 'match' || flip;
            const energy = Math.max(0, Math.min(1, burst.energy ?? 0));
            const warm = rim ? burst.rimMood === 'match' ? '#baffdf' : burst.rimMood === 'charge' ? '#ffb34b' : '#ffe3a3'
                : bomb ? '#ffd391' : burst.kind === 'chain' ? '#ffb34b' : flip ? '#9cebea' : '#ffe0a0';
            const density = burst.quality === 'low' ? 0.45 : burst.quality === 'medium' ? 0.7 : 1;
            const shaped = ember && burst.shape ? burst.shape : null;
            const sparks = Math.round((rim ? 2 + energy * 2 : shaped ? 1 + energy * 3 : ember ? 2 + energy * 4 : bomb ? 44 : flip ? 8 : 28 + energy * 12) * density);
            const smoke = bomb ? Math.round(8 * density) : 0;
            const count = burst.reduceMotion ? (flip || rim || ripple || ember ? 0 : 1) : ripple ? (burst.quality === 'low' ? 2 : 3) : ember ? sparks : sparks + smoke + (edge ? 0 : 1);
            let emitted = 0;
            for (let index = 0; index < count; index += 1) {
                // Ambient rim trails use only free slots, so hovering cannot erase an explosion.
                if (rim || ember) {
                    let checked = 0;
                    while (ends[cursor % budget]! > burst.time && checked++ < budget) cursor += 1;
                    if (checked >= budget) break;
                }
                if (!rim && !ripple && !ember) {
                    let checked = 0;
                    while (ends[cursor % budget]! > burst.time && lifetime.getW(cursor % budget) === 6 && checked++ < budget) cursor += 1;
                    if (checked >= budget) break;
                }
                const slot = cursor++ % budget;
                const kind = burst.reduceMotion ? 3 : ripple ? 6 : edge ? 4 : shaped ? BOARD_PARTICLE_SHAPE_KIND[shaped] : ember ? 0 : index >= sparks + smoke ? 1 : index >= sparks ? 2 : 0;
                const angle = ripple ? 0 : rng() * Math.PI * 2;
                const speed = kind === 0 ? (bomb ? 1.2 : 0.45) * (0.35 + rng()) : kind === 2 ? 0.28 : 0;
                const life = burst.reduceMotion ? 0.5 : ripple ? 0.65 + index * 0.08 : rim ? 0.3 + rng() * 0.3
                    : shaped === 'flame' ? 0.55 + rng() * 0.5 : shaped === 'droplet' ? 0.8 + rng() * 0.5 : shaped === 'shard' ? 1.1 + rng() * 0.8 : shaped === 'leaf' ? 1.3 + rng() * 0.9
                    : ember ? 0.9 + rng() * 0.8 : kind === 1 ? 0.65 : kind === 2 ? 1.1 : 0.45 + rng() * 0.65;
                const start = burst.time + (burst.reduceMotion ? 0 : burst.delay ?? 0) + (ripple ? index * 0.085 : kind === 2 ? 0.05 : edge && !rim ? index / Math.max(1, sparks) * 0.16 : 0);
                const size = ripple ? 2.1 + energy * 1.2 + index * 0.32 : kind === 3 ? 1.05 : kind === 4 ? (rim ? 0.065 : 0.11) + rng() * 0.055 + energy * 0.035
                    : kind === 1 ? (bomb ? 1.3 : 0.75) : kind === 2 ? 0.7 : 0.035 + rng() * (bomb ? 0.09 : 0.055);
                const offset = kind === 0 ? (flip ? 0.32 : 0.13) : 0;
                if (edge && !burst.reduceMotion) {
                    sampleCardRim(rim ? burst.time * (0.42 + energy * 0.2) + index / sparks + (burst.seed % 97) / 97
                        : index / sparks + (burst.seed % 31) / 31, rimSample);
                    point.set(rimSample.x, rimSample.y, 0.025);
                    const outward = rim ? 0.05 + energy * 0.06 : flip ? 0.09 : 0.32 + energy * 0.25;
                    direction.set(rimSample.nx * outward + rimSample.ny * 0.09, rimSample.ny * outward - rimSample.nx * 0.09, 0);
                    if (burst.cardMatrix) {
                        direction.add(point).applyMatrix4(burst.cardMatrix);
                        point.applyMatrix4(burst.cardMatrix);
                        direction.sub(point);
                    } else { point.x += burst.x; point.y += burst.y; point.z += burst.z; }
                    origin.setXYZ(slot, point.x, point.y, point.z + 0.06);
                    movement.setXYZW(slot, direction.x, direction.y + (rim ? 0.06 : 0.12), -0.08, 1.5);
                } else if (shaped) {
                    // The card's own material, born on its face and moving as that material moves.
                    const px = burst.x + (rng() - 0.5) * 0.6;
                    if (shaped === 'flame') {
                        // Off the foot of the card, straight up, faster the longer it burns.
                        origin.setXYZ(slot, px, burst.y - 0.38 + rng() * 0.45, burst.z + 0.07);
                        movement.setXYZW(slot, (rng() - 0.5) * 0.1, 0.22 + rng() * 0.2 + energy * 0.3, -(0.25 + energy * 0.3), 0.8);
                    } else if (shaped === 'droplet') {
                        // Beads on the face, hangs a moment, then falls under its own weight.
                        origin.setXYZ(slot, px, burst.y + (rng() - 0.5) * 0.7, burst.z + 0.07);
                        movement.setXYZW(slot, (rng() - 0.5) * 0.03, -0.01, 0.7 + rng() * 0.5 + energy * 0.4, 0.25);
                    } else if (shaped === 'shard') {
                        // Breaks off and drifts out slowly, turning, barely sinking.
                        const theta = rng() * Math.PI * 2;
                        origin.setXYZ(slot, px, burst.y + (rng() - 0.5) * 0.75, burst.z + 0.07);
                        movement.setXYZW(slot, Math.cos(theta) * (0.06 + energy * 0.1), Math.sin(theta) * (0.06 + energy * 0.1), 0.03, 0.7);
                    } else {
                        // Shed from the top, falling and swaying.
                        origin.setXYZ(slot, px, burst.y + 0.1 + rng() * 0.4, burst.z + 0.07);
                        movement.setXYZW(slot, (rng() - 0.5) * 0.3, -(0.04 + rng() * 0.08), 0.1 + energy * 0.08, 0.7);
                    }
                } else if (ember) {
                    // Born somewhere on the card's face, drifting up and a little sideways, rising
                    // faster the longer it lives (negative gravity), damped so it never streaks.
                    const mode = burst.emberMode ?? 'rise';
                    origin.setXYZ(slot, burst.x + (rng() - 0.5) * 0.55, burst.y + (rng() - 0.5) * 0.7 + (mode === 'fall' ? 0.3 : 0), burst.z + 0.07);
                    if (mode === 'fall') {
                        // Snow: drifts down slowly, swaying, and settles rather than accelerating.
                        movement.setXYZW(slot, (rng() - 0.5) * 0.18, -(0.05 + rng() * 0.08), 0.06 + energy * 0.05, 0.6);
                    } else if (mode === 'spark') {
                        // Static: thrown out fast in any direction and gone quickly.
                        const theta = rng() * Math.PI * 2;
                        movement.setXYZW(slot, Math.cos(theta) * (0.4 + energy * 0.4), Math.sin(theta) * (0.4 + energy * 0.4), 0, 3.5);
                    } else {
                        movement.setXYZW(slot, (rng() - 0.5) * 0.12, 0.18 + rng() * 0.25 + energy * 0.25, -(0.12 + energy * 0.2), 0.9);
                    }
                } else {
                    origin.setXYZ(slot, burst.x + Math.cos(angle) * offset, burst.y + Math.sin(angle) * offset, ripple ? -0.025 : burst.z + 0.06);
                    movement.setXYZW(slot, Math.cos(angle) * speed, Math.sin(angle) * speed + (kind === 2 ? 0.35 : 0),
                        kind === 0 ? (bomb ? 1.2 : 0.25) : 0, bomb ? 2.1 : 1.2);
                }
                if (shaped && burst.placement) {
                    sampleCardRim(rng(), rimSample);
                    const ground = burst.placement === 'ground';
                    const spread = ground ? 1.15 : 1;
                    origin.setXYZ(slot, burst.x + rimSample.x * spread, burst.y + rimSample.y * spread, burst.z + (ground ? 0.02 : 0.09));
                    if (shaped === 'leaf' || ground) {
                        // Leaves lace the edge; floor motes stay close to the affected cell.
                        movement.setXYZW(slot, rimSample.ny * 0.1, -rimSample.nx * 0.1, ground ? 0 : 0.025, 1.5);
                    }
                }
                lifetime.setXYZW(slot, start, life, shaped ? (0.085 + rng() * 0.05 + energy * 0.05) * (shaped === 'flame' ? 1.5 : 1) * (burst.sizeScale ?? 1) : ember ? (0.03 + rng() * 0.045 + energy * 0.03) * (burst.sizeScale ?? 1) : size, kind);
                color.set(kind === 2 ? '#795a44' : ember && burst.tint ? burst.tint : warm);
                if (kind === 0 && rng() > 0.7) color.set('#fff2ce');
                tint.setXYZ(slot, color.r, color.g, color.b);
                // A flame and a drop stay upright; a shard turns slowly and a leaf tumbles.
                if (shaped) rotation.setXY(slot, shaped === 'flame' || shaped === 'droplet' ? 0 : angle, shaped === 'shard' ? (rng() - 0.5) * 1.2 : shaped === 'leaf' ? (rng() - 0.5) * 4 : 0);
                else rotation.setXY(slot, angle, kind === 0 ? (rng() - 0.5) * 3 : 0);
                ends[slot] = start + life;
                comboPopSlots[slot] = pop ? 1 : 0;
                emitted += 1;
            }
            if (emitted > 0) {
                for (const value of attributes) value.needsUpdate = true;
                mesh.visible = true;
                rippleMesh.visible = true;
            }
            return emitted;
        },
        /**
         * A combo-scaled lightning bolt: one strand at a fresh combo, up to three with forks at
         * the top, each strand drawn tip-first so the charge is seen travelling. Returns quads used.
         */
        emitArc(arc: BoardArcBurst): number {
            if (!comboPopEffects) return 0;
            configure(arc.quality);
            if (arc.reduceMotion) return 0;
            const intensity = Math.max(0, Math.min(1, arc.intensity));
            const rng = createMulberry32(arc.seed);
            const lowTier = arc.quality === 'low';
            const extra = Math.max(0, Math.floor(arc.extraStrands ?? 0));
            const strands = lowTier ? 1 : Math.min(arc.quality === 'medium' ? 3 : 6, 1 + (intensity > 0.4 ? 1 : 0) + (intensity > 0.7 ? 1 : 0) + extra);
            const segments = lowTier ? 5 : 6 + Math.round(intensity * 4);
            const forks = lowTier ? 0 : Math.round(intensity * (arc.quality === 'medium' ? 2 : 3));
            const width = 0.045 + intensity * 0.07;
            const life = 0.38 + intensity * 0.3;
            const travel = 0.07;
            const start = arc.time + (arc.delay ?? 0);
            const z = Math.max(arc.from.z, arc.to.z) + 0.09;
            arcColor.set(arc.tint ?? comboArcTint(intensity));
            let emitted = 0;
            for (let strand = 0; strand < strands; strand += 1) {
                const path = buildLightningPath(arc.from.x, arc.from.y, arc.to.x, arc.to.y,
                    arc.seed + strand * 7919, segments, 0.1 + intensity * 0.08 + strand * 0.04);
                const strandWidth = strand === 0 ? width : width * 0.55;
                for (let index = 0; index < segments; index += 1) {
                    const slot = claimSlot(start);
                    if (slot === null) break;
                    writeSegment(slot, path[index * 2]!, path[index * 2 + 1]!, path[index * 2 + 2]!, path[index * 2 + 3]!, z,
                        strandWidth, start + index / segments * travel + strand * 0.03, life - strand * 0.05);
                    emitted += 1;
                }
                if (strand > 0) continue;
                for (let fork = 0; fork < forks; fork += 1) {
                    const at = 1 + Math.floor(rng() * Math.max(1, segments - 2));
                    const ax = path[at * 2]!;
                    const ay = path[at * 2 + 1]!;
                    const heading = Math.atan2(arc.to.y - arc.from.y, arc.to.x - arc.from.x) + (rng() > 0.5 ? 1 : -1) * (0.5 + rng() * 0.5);
                    const reach = Math.hypot(arc.to.x - arc.from.x, arc.to.y - arc.from.y) / segments * (1.2 + rng());
                    const branch = buildLightningPath(ax, ay, ax + Math.cos(heading) * reach, ay + Math.sin(heading) * reach,
                        arc.seed + 131 * (fork + 1), 2, 0.25);
                    for (let index = 0; index < 2; index += 1) {
                        const slot = claimSlot(start);
                        if (slot === null) break;
                        writeSegment(slot, branch[index * 2]!, branch[index * 2 + 1]!, branch[index * 2 + 2]!, branch[index * 2 + 3]!, z,
                            width * 0.45, start + at / segments * travel + 0.02, life * 0.6);
                        emitted += 1;
                    }
                }
            }
            if (emitted > 0) {
                for (const value of attributes) value.needsUpdate = true;
                mesh.visible = true;
                rippleMesh.visible = true;
            }
            return emitted;
        },
        advance(time: number): number {
            if (!mesh.visible) return 0;
            material.uniforms.time.value = time;
            rippleMaterial.uniforms.time.value = time;
            let active = 0;
            for (let index = 0; index < budget; index += 1) if (ends[index]! > time) active += 1;
            mesh.visible = active > 0;
            rippleMesh.visible = active > 0;
            return active;
        },
        dispose(): void { geometry.dispose(); material.dispose(); rippleMaterial.dispose(); }
    };
};
