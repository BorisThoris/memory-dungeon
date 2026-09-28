import {
    BufferAttribute, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
    Mesh, NormalBlending, ShaderMaterial, Vector3, type Matrix4
} from 'three';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { createMulberry32 } from '../../shared/rng';
import { noopMeshRaycast } from './tileBoardPick';
import { sampleCardRim, type RimParticleMood } from './boardParticleRim';

export type BoardParticleKind = 'bomb' | 'match' | 'flip' | 'chain' | 'rim' | 'ripple';
export const BOARD_PARTICLE_CAPACITY = 384;
export const boardParticleBudget = (quality: GraphicsQualityPreset): number =>
    quality === 'low' ? 96 : quality === 'medium' ? 192 : BOARD_PARTICLE_CAPACITY;

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
}

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
        bool ripple = vKind > 5.5;
        if ((ripple && rippleLayer < 0.5) || (!ripple && rippleLayer > 0.5) || lifetime.y <= 0.0 || age < 0.0 || age >= 1.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
        }
        float travel = (1.0 - exp(-movement.w * seconds)) / max(movement.w, 0.001);
        vec3 center = origin + vec3(movement.xy * travel, 0.0);
        center.y -= movement.z * seconds * seconds * 0.5;
        float scale = lifetime.z * mix(1.0, 0.22, age);
        if (vKind > 0.5 && vKind < 1.5) scale = lifetime.z * mix(0.45, 2.1, age);
        if (vKind > 1.5 && vKind < 2.5) scale = lifetime.z * mix(0.5, 1.5, age);
        if (vKind > 2.5 && vKind < 3.5) scale = lifetime.z;
        if (vKind > 3.5) scale = lifetime.z * mix(1.0, 0.35, age);
        if (ripple) scale = lifetime.z * mix(0.3, 1.0, 1.0 - pow(1.0 - age, 3.0));
        float angle = rotation.x + rotation.y * seconds;
        vec2 local = position.xy * scale;
        if (vKind < 0.5) local.y *= 2.2;
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
    void main() {
        if (vAge < 0.0 || vAge >= 1.0) discard;
        vec2 p = vUv * 2.0 - 1.0;
        float radius = length(p);
        float shape = pow(max(0.0, 1.0 - radius), 2.0);
        float strength = 0.9;
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
        if (vKind > 5.5) {
            float band = abs(radius - 0.76);
            shape = exp(-band * band * 1800.0) + exp(-band * band * 110.0) * 0.3;
            strength = 0.72;
        }
        float fade = smoothstep(0.0, 0.06, vAge) * pow(1.0 - vAge, 1.5);
        float alpha = shape * fade * strength;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vTint, alpha);
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
    const color = new Color();
    const point = new Vector3();
    const direction = new Vector3();
    const rimSample = { x: 0, y: 0, nx: 0, ny: 0 };
    let cursor = 0;
    let budget = BOARD_PARTICLE_CAPACITY;

    const clear = (): void => {
        ends.fill(0);
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
        emit(burst: BoardParticleBurst): number {
            configure(burst.quality);
            const rng = createMulberry32(burst.seed);
            const bomb = burst.kind === 'bomb';
            const flip = burst.kind === 'flip';
            const rim = burst.kind === 'rim';
            const ripple = burst.kind === 'ripple';
            const edge = rim || burst.kind === 'match' || flip;
            const energy = Math.max(0, Math.min(1, burst.energy ?? 0));
            const warm = rim ? burst.rimMood === 'match' ? '#baffdf' : burst.rimMood === 'charge' ? '#ffb34b' : '#ffe3a3'
                : bomb ? '#ffd391' : burst.kind === 'chain' ? '#ffb34b' : flip ? '#9cebea' : '#ffe0a0';
            const density = burst.quality === 'low' ? 0.45 : burst.quality === 'medium' ? 0.7 : 1;
            const sparks = Math.round((rim ? 2 + energy * 2 : bomb ? 44 : flip ? 8 : 28 + energy * 12) * density);
            const smoke = bomb ? Math.round(8 * density) : 0;
            const count = burst.reduceMotion ? (flip || rim || ripple ? 0 : 1) : ripple ? (burst.quality === 'low' ? 2 : 3) : sparks + smoke + (edge ? 0 : 1);
            let emitted = 0;
            for (let index = 0; index < count; index += 1) {
                // Ambient rim trails use only free slots, so hovering cannot erase an explosion.
                if (rim) {
                    let checked = 0;
                    while (ends[cursor % budget]! > burst.time && checked++ < budget) cursor += 1;
                    if (checked >= budget) break;
                }
                if (!rim && !ripple) {
                    let checked = 0;
                    while (ends[cursor % budget]! > burst.time && lifetime.getW(cursor % budget) === 6 && checked++ < budget) cursor += 1;
                    if (checked >= budget) break;
                }
                const slot = cursor++ % budget;
                const kind = burst.reduceMotion ? 3 : ripple ? 6 : edge ? 4 : index >= sparks + smoke ? 1 : index >= sparks ? 2 : 0;
                const angle = ripple ? 0 : rng() * Math.PI * 2;
                const speed = kind === 0 ? (bomb ? 1.2 : 0.45) * (0.35 + rng()) : kind === 2 ? 0.28 : 0;
                const life = burst.reduceMotion ? 0.5 : ripple ? 0.65 + index * 0.08 : rim ? 0.3 + rng() * 0.3 : kind === 1 ? 0.65 : kind === 2 ? 1.1 : 0.45 + rng() * 0.65;
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
                } else {
                    origin.setXYZ(slot, burst.x + Math.cos(angle) * offset, burst.y + Math.sin(angle) * offset, ripple ? -0.025 : burst.z + 0.06);
                    movement.setXYZW(slot, Math.cos(angle) * speed, Math.sin(angle) * speed + (kind === 2 ? 0.35 : 0),
                        kind === 0 ? (bomb ? 1.2 : 0.25) : 0, bomb ? 2.1 : 1.2);
                }
                lifetime.setXYZW(slot, start, life, size, kind);
                color.set(kind === 2 ? '#795a44' : warm);
                if (kind === 0 && rng() > 0.7) color.set('#fff2ce');
                tint.setXYZ(slot, color.r, color.g, color.b);
                rotation.setXY(slot, angle, kind === 0 ? (rng() - 0.5) * 3 : 0);
                ends[slot] = start + life;
                emitted += 1;
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
