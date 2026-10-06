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
    /** Casts and realm events may reclaim ambient slots, so weather never hides a decision. */
    priority?: 'event';
}

export type BoardParticleShape = 'flame' | 'droplet' | 'shard' | 'leaf' | 'vapor' | 'spark';
/** The shader's kind code for each shape, after the bolt's seven. */
export const BOARD_PARTICLE_SHAPE_KIND: Readonly<Record<BoardParticleShape, number>> = { flame: 8, droplet: 9, shard: 10, leaf: 11, vapor: 12, spark: 13 };

const vertexShader = /* glsl */ `
    attribute vec3 origin;
    attribute vec4 movement;
    attribute vec4 lifetime;
    attribute vec3 tint;
    attribute vec2 rotation;
    // Independent phase, energy, and the board/foreground layer, all fixed at emission.
    attribute vec4 appearance;
    uniform float time;
    uniform float rippleLayer;
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vAge;
    varying float vKind;
    varying float vPhase;
    varying float vSeconds;
    varying float vEnergy;
    varying float vEmphasis;
    void main() {
        float seconds = max(0.0, time - lifetime.x);
        float age = (time - lifetime.x) / max(0.001, lifetime.y);
        vUv = uv; vTint = tint; vAge = age; vKind = lifetime.w;
        vPhase = appearance.x; vEnergy = appearance.y; vSeconds = seconds; vEmphasis = appearance.w;
        bool ripple = vKind > 5.5 && vKind < 6.5;
        bool ground = ripple || appearance.z > 0.5;
        if ((ground && rippleLayer < 0.5) || (!ground && rippleLayer > 0.5) || lifetime.y <= 0.0 || age < 0.0 || age >= 1.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
        }
        if (vKind > 6.5 && vKind < 7.5) {
            vec2 segment = vec2(position.x * lifetime.z, position.y * movement.z);
            segment = mat2(cos(rotation.x), sin(rotation.x), -sin(rotation.x), cos(rotation.x)) * segment;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(origin + vec3(segment, 0.0), 1.0);
            return;
        }
        float travel = (1.0 - exp(-movement.w * seconds)) / max(movement.w, 0.001);
        vec3 center = origin + vec3(movement.xy * travel, 0.0);
        center.y -= movement.z * seconds * seconds * 0.5;
        bool flame = vKind > 7.5 && vKind < 8.5;
        bool drop = vKind > 8.5 && vKind < 9.5;
        bool ice = vKind > 9.5 && vKind < 10.5;
        bool leaf = vKind > 10.5 && vKind < 11.5;
        bool vapor = vKind > 11.5 && vKind < 12.5;
        bool spark = vKind > 12.5;
        // Smooth per-particle turbulence, with zero displacement at birth.
        if (flame || vapor || leaf) {
            float frequency = flame ? 6.0 : leaf ? 3.2 : 2.0;
            float amplitude = flame ? 0.045 : leaf ? 0.09 : 0.12;
            center.x += (sin(seconds * frequency + vPhase) - sin(vPhase)) * amplitude * min(seconds * 3.0, 1.0);
        }
        float scale = lifetime.z * mix(1.0, 0.22, age);
        if (vKind > 0.5 && vKind < 1.5) scale = lifetime.z * mix(0.45, 2.1, age);
        if (vKind > 1.5 && vKind < 2.5) scale = lifetime.z * mix(0.5, 1.5, age);
        if (vKind > 2.5 && vKind < 3.5) scale = lifetime.z;
        if (vKind > 3.5) scale = lifetime.z * mix(1.0, 0.35, age);
        if (flame) scale = lifetime.z * mix(1.15, 0.4, age);
        if (drop || ice || leaf) scale = lifetime.z * (0.85 + 0.15 * sin(age * 3.14159));
        if (vapor) scale = lifetime.z * mix(0.35, 1.7, age);
        if (ripple) scale = lifetime.z * mix(0.3, 1.0, 1.0 - pow(1.0 - age, 3.0));
        float angle = rotation.x + rotation.y * seconds;
        vec2 local = position.xy * scale;
        if (vKind < 0.5 || spark) {
            // A short, velocity-aligned streak rather than a spinning round point.
            vec2 velocity = movement.xy * exp(-movement.w * seconds) - vec2(0.0, movement.z * seconds);
            angle = atan(velocity.y, velocity.x) - 1.570796;
            local.y *= 1.0 + min(3.0, length(velocity) * 2.5);
        }
        if (flame) local.y *= 1.9;
        if (drop) local.y *= 1.2 + min(1.2, movement.z * seconds);
        if (ice) local.y *= 1.5;
        if (leaf) local.x *= 0.22 + 0.78 * abs(cos(seconds * 3.0 + vPhase));
        if (ripple) local.y *= 0.72;
        local = mat2(cos(angle), sin(angle), -sin(angle), cos(angle)) * local;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(center + vec3(local, 0.0), 1.0);
    }
`;
const fragmentShader = /* glsl */ `
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vAge;
    varying float vKind;
    varying float vPhase;
    varying float vSeconds;
    varying float vEnergy;
    varying float vEmphasis;
    float hash21(vec2 p) {
        p = fract(p * vec2(123.34, 345.45));
        p += dot(p, p + 34.345);
        return fract(p.x * p.y);
    }
    float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash21(i), hash21(i + vec2(1, 0)), f.x),
            mix(hash21(i + vec2(0, 1)), hash21(i + vec2(1, 1)), f.x), f.y);
    }
    // Two octaves only; no textures, extra passes, or full-screen distortion.
    float flow(vec2 p) { return noise(p) * 0.67 + noise(p * 2.03 + 13.7) * 0.33; }
    float coverage(float distance) {
        float aa = max(fwidth(distance), 0.012);
        return 1.0 - smoothstep(-aa, aa, distance);
    }
    void main() {
        if (vAge < 0.0 || vAge >= 1.0) discard;
        vec2 p = vUv * 2.0 - 1.0;
        float radius = length(p);
        float shape = exp(-dot(p * vec2(2.5, 1.3), p * vec2(2.5, 1.3)) * 2.0);
        float strength = 0.9;
        vec3 color = vTint;
        if (vKind > 0.5 && vKind < 1.5) {
            shape = coverage(abs(radius - 0.72) - 0.035);
            strength = 0.58;
        }
        if (vKind > 1.5 && vKind < 2.5) {
            shape = pow(max(0.0, 1.0 - radius), 1.6) * (0.65 + flow(p * 3.0 + vPhase));
            strength = 0.32;
        }
        if (vKind > 2.5 && vKind < 3.5) { shape = coverage(abs(radius - 0.7) - 0.07); strength = 0.3; }
        if (vKind > 3.5 && vKind < 5.5) {
            float core = exp(-radius * radius * 18.0);
            float rays = exp(-abs(p.x * p.y) * 55.0) * pow(max(0.0, 1.0 - radius), 2.0);
            float diamond = coverage(abs(p.x) + abs(p.y) - 0.34);
            shape = core * 0.65 + rays * 0.45 + diamond * 0.32;
            color = mix(vTint, vec3(1.0, 0.97, 0.9), core * (0.4 + 0.25 * vEnergy));
        }
        if (vKind > 5.5 && vKind < 6.5) {
            float band = abs(radius - 0.76);
            float angle = atan(p.y, p.x);
            float crests = 0.72 + 0.28 * sin(angle * 12.0 + vPhase);
            float echo = abs(radius - 0.59 - vAge * 0.05);
            shape = coverage(band - 0.012) * crests + exp(-band * band * 160.0) * 0.18
                + coverage(echo - 0.007) * (1.0 - vAge) * 0.24;
            color = mix(vTint, vec3(1.0), exp(-band * band * 2200.0) * 0.24);
            strength = 0.65;
        }
        if (vKind > 6.5 && vKind < 7.5) {
            float d = abs(p.y);
            float core = exp(-d * d * 28.0);
            shape = (core + exp(-d * d * 3.0) * 0.5) * (0.85 + 0.15 * sin(vSeconds * 15.0 + vPhase));
            color = mix(vTint, vec3(1.0), core * 0.7);
        }
        if (vKind > 7.5 && vKind < 8.5) {
            float up = vUv.y;
            float turbulence = flow(vec2(p.x * 3.0 + vPhase, p.y * 2.5 - vSeconds * 5.0));
            float bend = (turbulence - 0.5) * (0.15 + up * 0.5);
            float body = length(vec2((p.x + bend) * (1.3 + 3.0 * up * up), p.y + 0.12));
            float edge = body - 0.82 + (turbulence - 0.5) * up * 0.45;
            shape = coverage(edge) * (1.0 - smoothstep(0.2, 0.92, body));
            float core = (1.0 - smoothstep(0.12, 0.58, body)) * (1.0 - up * 0.65);
            color = mix(vTint, vec3(0.95, 0.085, 0.008), up * 0.7);
            color = mix(color, vec3(1.0, 0.92, 0.55), core);
            strength = 0.95;
        }
        if (vKind > 8.5 && vKind < 9.5) {
            float neck = max(0.0, p.y);
            float d = length(vec2(p.x * (1.15 + 1.9 * neck * neck), p.y + 0.08));
            shape = coverage(d - 0.86);
            float rim = smoothstep(0.42, 0.85, d);
            vec2 light = p - vec2(-0.24, 0.15);
            float highlight = exp(-dot(light * vec2(1.5, 0.75), light * vec2(1.5, 0.75)) * 34.0);
            float caustic = pow(0.5 + 0.5 * sin(p.y * 8.0 + p.x * 4.0 - vSeconds * 4.0 + vPhase), 8.0);
            color = vTint * (0.75 + rim * 0.4 + caustic * 0.35) + vec3(highlight * 0.85);
            strength = 0.5 + rim * 0.35;
        }
        if (vKind > 9.5 && vKind < 10.5) {
            // Six cut facets, a bevel, and a glint moving across the crystal.
            float d = max(abs(p.x) * 1.65, abs(p.x) * 0.85 + abs(p.y)) - 0.82;
            shape = coverage(d);
            float facet = 0.5 + 0.22 * step(0.0, p.x) + 0.2 * step(0.0, p.y * p.x);
            float bevel = exp(-abs(d + 0.06) * 35.0);
            float glint = exp(-pow(p.x + p.y * 0.45 - sin(vSeconds * 2.5 + vPhase) * 0.9, 2.0) * 110.0);
            color = mix(vTint * facet, vec3(1.0), clamp(bevel * 0.55 + glint * 0.7, 0.0, 1.0));
        }
        if (vKind > 10.5 && vKind < 11.5) {
            float blade = max(abs(p.x + p.y * 0.12) - (1.0 - p.y * p.y) * 0.5, abs(p.y) - 0.95);
            shape = coverage(blade);
            float stem = exp(-abs(p.x + p.y * 0.12) * 55.0);
            float veins = pow(max(0.0, cos((p.y - abs(p.x) * 0.85) * 26.0)), 12.0);
            float translucency = 0.85 + 0.25 * sin(vSeconds * 3.0 + vPhase);
            color = vTint * translucency * (0.85 + 0.22 * step(0.0, p.x)) + vTint * (stem + veins * 0.25) * 0.3;
        }
        if (vKind > 11.5 && vKind < 12.5) {
            // Steam curls outwards, with holes opening as its soft billows dissipate.
            float n = flow(p * 2.8 + vec2(vPhase, -vSeconds * 0.7));
            shape = (1.0 - smoothstep(0.25, 0.95, radius + (n - 0.5) * 0.45)) * smoothstep(0.12, 0.7, n);
            color = mix(vTint * 0.65, vec3(1.0), n * 0.65);
            strength = 0.42;
        }
        if (vKind > 12.5) {
            float zig = sin(p.y * 12.0 + vPhase) * 0.1 * (1.0 - abs(p.y));
            float core = exp(-pow(p.x + zig, 2.0) * 240.0);
            shape = (core + exp(-pow(p.x + zig, 2.0) * 25.0) * 0.35) * (1.0 - smoothstep(0.5, 1.0, abs(p.y)));
            color = mix(vTint, vec3(1.0), core * 0.75);
        }
        float fade = smoothstep(0.0, 0.07, vAge) * (1.0 - smoothstep(0.35, 1.0, vAge));
        // Ambient weather sits behind decision feedback in contrast as well as emission priority.
        float alpha = clamp(shape * fade * strength * (0.85 + vEnergy * 0.15) * vEmphasis, 0.0, .92);
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
    const appearance = attribute('appearance', 4);
    const attributes = [origin, movement, lifetime, tint, rotation, appearance];
    let dirtyStart = BOARD_PARTICLE_CAPACITY;
    let dirtyEnd = -1;
    const markSlotWritten = (slot: number): void => {
        dirtyStart = Math.min(dirtyStart, slot);
        dirtyEnd = Math.max(dirtyEnd, slot);
        geometry.instanceCount = Math.max(geometry.instanceCount, slot + 1);
    };
    // A frame can emit many bursts. Upload one contiguous range per attribute, once before drawing.
    const flushWrites = (): void => {
        if (dirtyEnd < dirtyStart) return;
        for (const value of attributes) {
            value.addUpdateRange(dirtyStart * value.itemSize, (dirtyEnd - dirtyStart + 1) * value.itemSize);
            value.needsUpdate = true;
        }
        dirtyStart = BOARD_PARTICLE_CAPACITY;
        dirtyEnd = -1;
    };
    geometry.instanceCount = 0;
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
    const priorities = new Uint8Array(BOARD_PARTICLE_CAPACITY);
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
        while (ends[cursor % budget]! > time && (lifetime.getW(cursor % budget) === 6 || priorities[cursor % budget] === 3) && checked++ < budget) cursor += 1;
        return checked >= budget ? null : cursor++ % budget;
    };
    /** Current decisions reclaim ambience first, then the oldest cosmetic burst. Rings keep their contact beat. */
    const claimEventSlot = (time: number): number | null => {
        let candidate = -1;
        for (let n = 0; n < budget; n += 1) {
            const slot = (cursor + n) % budget;
            if (ends[slot]! <= time) { cursor = slot + 1; return slot; }
            if (lifetime.getW(slot) === 6) continue;
            if (candidate < 0 || priorities[slot]! < priorities[candidate]!
                || (priorities[slot] === priorities[candidate] && ends[slot]! < ends[candidate]!)) candidate = slot;
        }
        if (candidate < 0) return null;
        cursor = candidate + 1;
        return candidate;
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
        priorities[slot] = 2;
        appearance.setXYZW(slot, start * 7.1, 1, 0, 1);
        markSlotWritten(slot);
    };

    const clear = (): void => {
        ends.fill(0);
        comboPopSlots.fill(0);
        priorities.fill(0);
        lifetime.array.fill(0);
        lifetime.clearUpdateRanges();
        lifetime.addUpdateRange(0, lifetime.array.length);
        lifetime.needsUpdate = true;
        dirtyStart = BOARD_PARTICLE_CAPACITY;
        dirtyEnd = -1;
        geometry.instanceCount = 0;
        cursor = 0;
        mesh.visible = false;
        rippleMesh.visible = false;
    };
    const configure = (quality: GraphicsQualityPreset): void => {
        const nextBudget = boardParticleBudget(quality);
        if (nextBudget !== budget) { clear(); budget = nextBudget; }
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
            let removed = false;
            for (let slot = 0; slot < budget; slot += 1) {
                if (!comboPopSlots[slot]) continue;
                ends[slot] = 0;
                lifetime.setXYZW(slot, 0, 0, 0, 0);
                comboPopSlots[slot] = 0;
                lifetime.addUpdateRange(slot * lifetime.itemSize, lifetime.itemSize);
                removed = true;
            }
            if (removed) lifetime.needsUpdate = true;
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
                if ((rim || ember) && burst.priority !== 'event') {
                    let checked = 0;
                    while (ends[cursor % budget]! > burst.time && checked++ < budget) cursor += 1;
                    if (checked >= budget) break;
                }
                if (!rim && !ripple && !ember) {
                    let checked = 0;
                    while (ends[cursor % budget]! > burst.time && (lifetime.getW(cursor % budget) === 6 || priorities[cursor % budget] === 3) && checked++ < budget) cursor += 1;
                    if (checked >= budget) break;
                }
                const slot = burst.priority === 'event' ? claimEventSlot(burst.time) : ripple ? claimSlot(burst.time) : cursor++ % budget;
                if (slot === null) break;
                const kind = burst.reduceMotion ? 3 : ripple ? 6 : edge ? 4 : shaped ? BOARD_PARTICLE_SHAPE_KIND[shaped] : ember ? 0 : index >= sparks + smoke ? 1 : index >= sparks ? 2 : 0;
                const angle = ripple ? 0 : rng() * Math.PI * 2;
                const speed = kind === 0 ? (bomb ? 1.2 : 0.45) * (0.35 + rng()) : kind === 2 ? 0.28 : 0;
                const life = burst.reduceMotion ? 0.5 : ripple ? 0.65 + index * 0.08 : rim ? 0.3 + rng() * 0.3
                    : shaped === 'vapor' ? 1.2 + rng() * 0.6 : shaped === 'spark' ? 0.25 + rng() * 0.3
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
                    } else if (shaped === 'vapor') {
                        origin.setXYZ(slot, px, burst.y + (rng() - 0.5) * 0.4, burst.z + 0.07);
                        movement.setXYZW(slot, (rng() - 0.5) * 0.18, 0.2 + energy * 0.18, -0.08, 0.6);
                    } else if (shaped === 'spark') {
                        const theta = rng() * Math.PI * 2;
                        origin.setXYZ(slot, px, burst.y + (rng() - 0.5) * 0.6, burst.z + 0.07);
                        movement.setXYZW(slot, Math.cos(theta) * (0.5 + energy * 0.5), Math.sin(theta) * (0.5 + energy * 0.5), 0, 2.5);
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
                lifetime.setXYZW(slot, start, life, shaped ? (0.085 + rng() * 0.05 + energy * 0.05) * (shaped === 'flame' ? 1.5 : shaped === 'vapor' ? 2.6 : 1) * (burst.sizeScale ?? 1) : ember ? (0.03 + rng() * 0.045 + energy * 0.03) * (burst.sizeScale ?? 1) : size, kind);
                color.set(kind === 2 ? '#795a44' : ember && burst.tint ? burst.tint : warm);
                if (kind === 0 && rng() > 0.7) color.set('#fff2ce');
                tint.setXYZ(slot, color.r, color.g, color.b);
                // A flame and a drop stay upright; a shard turns slowly and a leaf tumbles.
                if (shaped) rotation.setXY(slot, shaped === 'flame' || shaped === 'droplet' ? 0 : angle, shaped === 'shard' ? (rng() - 0.5) * 1.2 : shaped === 'leaf' ? (rng() - 0.5) * 4 : 0);
                else rotation.setXY(slot, angle, kind === 0 ? (rng() - 0.5) * 3 : 0);
                ends[slot] = start + life;
                comboPopSlots[slot] = pop ? 1 : 0;
                priorities[slot] = burst.priority === 'event' ? 3 : rim || ember ? 1 : 2;
                const emphasis = burst.priority === 'event' ? 1 : ember ? .58 : rim ? .72 : 1;
                appearance.setXYZW(slot, rng() * Math.PI * 2, energy, burst.placement === 'ground' ? 1 : 0, emphasis);
                markSlotWritten(slot);
                emitted += 1;
            }
            if (emitted > 0) {
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
                    const slot = claimSlot(arc.time);
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
                        const slot = claimSlot(arc.time);
                        if (slot === null) break;
                        writeSegment(slot, branch[index * 2]!, branch[index * 2 + 1]!, branch[index * 2 + 2]!, branch[index * 2 + 3]!, z,
                            width * 0.45, start + at / segments * travel + 0.02, life * 0.6);
                        emitted += 1;
                    }
                }
            }
            if (emitted > 0) {
                mesh.visible = true;
                rippleMesh.visible = true;
            }
            return emitted;
        },
        advance(time: number): number {
            flushWrites();
            material.uniforms.time.value = time;
            rippleMaterial.uniforms.time.value = time;
            let active = 0;
            let occupiedEnd = 0;
            let airborne = false;
            let ground = false;
            for (let index = 0; index < geometry.instanceCount; index += 1) {
                if (ends[index]! <= time) continue;
                active += 1;
                occupiedEnd = index + 1;
                // Pending bursts keep their slots but should not submit an invisible draw call.
                if (lifetime.getX(index) > time) continue;
                if (lifetime.getW(index) === 6 || appearance.getZ(index) > 0.5) ground = true;
                else airborne = true;
            }
            geometry.instanceCount = occupiedEnd;
            mesh.visible = airborne;
            rippleMesh.visible = ground;
            // Start a new idle sequence at slot zero instead of carrying a sparse high-water mark.
            if (!active) cursor = 0;
            return active;
        },
        dispose(): void { geometry.dispose(); material.dispose(); rippleMaterial.dispose(); }
    };
};
