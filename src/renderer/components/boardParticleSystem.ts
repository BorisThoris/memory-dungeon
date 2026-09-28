import {
    BufferAttribute, Color, DynamicDrawUsage, InstancedBufferAttribute, InstancedBufferGeometry,
    Mesh, NormalBlending, ShaderMaterial
} from 'three';
import type { GraphicsQualityPreset } from '../../shared/contracts';
import { createMulberry32 } from '../../shared/rng';
import { noopMeshRaycast } from './tileBoardPick';

export type BoardParticleKind = 'bomb' | 'match' | 'flip' | 'chain';
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
}

const vertexShader = `
    attribute vec3 origin;
    attribute vec4 movement;
    attribute vec4 lifetime;
    attribute vec3 tint;
    attribute vec2 rotation;
    uniform float time;
    varying vec2 vUv;
    varying vec3 vTint;
    varying float vAge;
    varying float vKind;
    void main() {
        float seconds = time - lifetime.x;
        float age = seconds / max(0.001, lifetime.y);
        vUv = uv; vTint = tint; vAge = age; vKind = lifetime.w;
        if (lifetime.y <= 0.0 || age < 0.0 || age >= 1.0) {
            gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
            return;
        }
        float travel = (1.0 - exp(-movement.w * seconds)) / max(movement.w, 0.001);
        vec3 center = origin + vec3(movement.xy * travel, 0.0);
        center.y -= movement.z * seconds * seconds * 0.5;
        float scale = lifetime.z * mix(1.0, 0.22, age);
        if (vKind > 0.5 && vKind < 1.5) scale = lifetime.z * mix(0.45, 2.1, age);
        if (vKind > 1.5 && vKind < 2.5) scale = lifetime.z * mix(0.5, 1.5, age);
        if (vKind > 2.5) scale = lifetime.z;
        float angle = rotation.x + rotation.y * seconds;
        vec2 local = position.xy * scale;
        if (vKind < 0.5) local.y *= 2.2;
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
        if (vKind > 2.5) { shape = 1.0 - smoothstep(0.05, 0.2, abs(radius - 0.7)); strength = 0.3; }
        float fade = smoothstep(0.0, 0.06, vAge) * pow(1.0 - vAge, 1.5);
        float alpha = shape * fade * strength;
        if (alpha < 0.003) discard;
        gl_FragColor = vec4(vTint, alpha);
        #include <colorspace_fragment>
    }
`;

/** One fixed GPU allocation and one draw call for every effect; emission never creates a mesh. */
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
        vertexShader, fragmentShader, uniforms: { time: { value: 0 } },
        transparent: true, depthWrite: false, depthTest: false, toneMapped: false, blending: NormalBlending
    });
    const mesh = new Mesh(geometry, material);
    mesh.name = 'board-particles';
    mesh.frustumCulled = false;
    mesh.raycast = noopMeshRaycast;
    mesh.renderOrder = 100;
    mesh.visible = false;
    const ends = new Float32Array(BOARD_PARTICLE_CAPACITY);
    const color = new Color();
    let cursor = 0;
    let budget = BOARD_PARTICLE_CAPACITY;

    const clear = (): void => {
        ends.fill(0);
        lifetime.array.fill(0);
        lifetime.needsUpdate = true;
        cursor = 0;
        mesh.visible = false;
    };
    const configure = (quality: GraphicsQualityPreset): void => {
        const nextBudget = boardParticleBudget(quality);
        if (nextBudget !== budget) { clear(); budget = nextBudget; }
        geometry.instanceCount = budget;
    };
    return {
        mesh,
        clear,
        configure,
        emit(burst: BoardParticleBurst): number {
            configure(burst.quality);
            const rng = createMulberry32(burst.seed);
            const bomb = burst.kind === 'bomb';
            const flip = burst.kind === 'flip';
            const warm = bomb ? '#ffd391' : burst.kind === 'chain' ? '#ffb34b' : flip ? '#9cebea' : '#ffe0a0';
            const density = burst.quality === 'low' ? 0.45 : burst.quality === 'medium' ? 0.7 : 1;
            const sparks = Math.round((bomb ? 44 : flip ? 6 : 20) * density);
            const smoke = bomb ? Math.round(8 * density) : 0;
            const count = burst.reduceMotion ? (flip ? 0 : 1) : sparks + smoke + (flip ? 0 : 1);
            for (let index = 0; index < count; index += 1) {
                const slot = cursor++ % budget;
                const kind = burst.reduceMotion ? 3 : index >= sparks + smoke ? 1 : index >= sparks ? 2 : 0;
                const angle = rng() * Math.PI * 2;
                const speed = kind === 0 ? (bomb ? 1.2 : 0.45) * (0.35 + rng()) : kind === 2 ? 0.28 : 0;
                const life = burst.reduceMotion ? 0.5 : kind === 1 ? 0.65 : kind === 2 ? 1.1 : 0.45 + rng() * 0.65;
                const start = burst.time + (burst.reduceMotion ? 0 : burst.delay ?? 0) + (kind === 2 ? 0.05 : 0);
                const size = kind === 3 ? 1.05 : kind === 1 ? (bomb ? 1.3 : 0.75) : kind === 2 ? 0.7 : 0.035 + rng() * (bomb ? 0.09 : 0.055);
                const offset = kind === 0 ? (flip ? 0.32 : 0.13) : 0;
                origin.setXYZ(slot, burst.x + Math.cos(angle) * offset, burst.y + Math.sin(angle) * offset, burst.z + 0.06);
                movement.setXYZW(slot, Math.cos(angle) * speed, Math.sin(angle) * speed + (kind === 2 ? 0.35 : 0),
                    kind === 0 ? (bomb ? 1.2 : 0.25) : 0, bomb ? 2.1 : 1.2);
                lifetime.setXYZW(slot, start, life, size, kind);
                color.set(kind === 2 ? '#795a44' : warm);
                if (kind === 0 && rng() > 0.7) color.set('#fff2ce');
                tint.setXYZ(slot, color.r, color.g, color.b);
                rotation.setXY(slot, angle, kind === 0 ? (rng() - 0.5) * 3 : 0);
                ends[slot] = start + life;
            }
            if (count > 0) {
                for (const value of attributes) value.needsUpdate = true;
                mesh.visible = true;
            }
            return count;
        },
        advance(time: number): number {
            if (!mesh.visible) return 0;
            material.uniforms.time.value = time;
            let active = 0;
            for (let index = 0; index < budget; index += 1) if (ends[index]! > time) active += 1;
            mesh.visible = active > 0;
            return active;
        },
        dispose(): void { geometry.dispose(); material.dispose(); }
    };
};
