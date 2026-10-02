import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, type ShaderMaterial } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { useAppStore } from '../store/useAppStore';
import { ELEMENT_CARD_MOTE } from './realmParticles';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

// Shape as well as colour carries the element. The front's quiet centre is completely
// transparent: neither an illustration nor a rank can be concealed by this material.
const fragmentShader = `
uniform float uTime;
uniform float uKind;
uniform float uFront;
uniform float uCharge;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    vec2 q = abs(p) - vec2(0.84, 0.88);
    float sdf = length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - 0.08;
    float clip = 1.0 - smoothstep(-0.012, 0.0, sdf);
    float edge = max(abs(p.x), abs(p.y));
    float border = smoothstep(0.55, 0.78, edge);
    float mask = mix(0.7, border, uFront) * clip;
    if (mask < 0.001) discard;
    float t = uTime;
    float pattern = 0.0;
    if (uKind < 0.5) {
        // Rising tongues and molten seams; a warm core travels up each fissure.
        float bend = sin(p.y * 8.0 - t * 2.8) * 0.35 + sin(p.y * 17.0 - t) * 0.12;
        float vein = abs(sin(p.x * 19.0 + bend * 3.0));
        pattern = (1.0 - smoothstep(0.07, 0.32, vein)) * (0.5 + 0.5 * sin(p.y * 5.0 - t * 3.0));
    } else if (uKind < 1.5) {
        // Intersecting caustics drift in different directions, never strobe.
        vec2 wave = p * vec2(11.0, 15.0);
        float a = sin(wave.x + sin(wave.y + t * 0.7) + t * 0.5);
        float b = sin(wave.y + sin(wave.x - t * 0.6) - t * 0.4);
        pattern = pow(1.0 - abs(a * b), 9.0);
    } else if (uKind < 2.5) {
        // Angular ice lattice with a slow travelling specular glint.
        float facet = min(abs(sin((p.x + p.y * 0.7) * 17.0)), abs(sin((p.x - p.y * 0.7) * 17.0)));
        float glint = pow(0.5 + 0.5 * sin(p.x * 3.0 + p.y * 4.0 - t * 0.8), 12.0);
        pattern = (1.0 - smoothstep(0.025, 0.14, facet)) * (0.35 + glint * 0.65);
    } else {
        // Winding stems and paired leaves, gently breathing along the grain.
        float stem = abs(sin(p.x * 13.0 + sin(p.y * 7.0) * 0.65));
        vec2 leaf = vec2(sin(p.x * 13.0 + sin(p.y * 7.0) * 0.65) * 2.2, sin(p.y * 19.0) * 0.8);
        pattern = max(1.0 - smoothstep(0.045, 0.16, stem), (1.0 - smoothstep(0.3, 0.65, length(leaf))) * 0.8);
        pattern *= 0.8 + 0.2 * sin(t * 1.2 + p.y * 4.0);
    }
    float rim = exp(-abs(sdf + 0.025) * 140.0);
    float alpha = mask * (mix(0.18, 0.68, uFront) + pattern * mix(0.48, 0.24, uFront) + rim * (0.2 + uCharge * 0.15));
    vec3 color = mix(uColor * mix(0.55, 0.24, uFront), uColor, pattern);
    color = mix(color, vec3(1.0), pattern * 0.35 + rim * uCharge * 0.3);
    gl_FragColor = vec4(color, alpha);
}`;

/** One outward-facing layer per side; back-face culling prevents light bleeding through a flip. */
export function ElementCardMaterial({ suit, faceZ, front, charge, seed, animated, reduceMotion }: {
    suit: TileSuit; faceZ: number; front: boolean; charge: number; seed: number; animated: boolean; reduceMotion: boolean;
}) {
    const material = useRef<ShaderMaterial>(null);
    const uniforms = useMemo(() => ({
        uTime: { value: (seed % 997) / 97 },
        uKind: { value: ['ember', 'tide', 'bone', 'moss'].indexOf(suit) },
        uFront: { value: front ? 1 : 0 },
        uCharge: { value: Math.min(1, charge * 0.2) },
        uColor: { value: new Color(ELEMENT_CARD_MOTE[suit].tint) }
    }), [suit, front, charge, seed]);
    useFrame((_, delta) => {
        if (!animated || reduceMotion || useAppStore.getState().run?.status === 'paused') return;
        if (material.current) material.current.uniforms.uTime!.value += Math.min(delta, 0.05);
    });
    return <group position={[0, 0, front ? faceZ : -faceZ]} rotation={[0, front ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0, 0.052]} raycast={noopMeshRaycast} renderOrder={11}>
            <planeGeometry args={[CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT]} />
            <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
                transparent depthWrite={false} toneMapped={false} />
        </mesh>
    </group>;
}
