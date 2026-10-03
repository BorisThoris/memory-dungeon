import { useMemo } from 'react';
import { Color } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { ELEMENT_CARD_MOTE } from './realmParticles';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragmentShader = `uniform vec3 uColor; uniform float uCharge; varying vec2 vUv;
void main() {
    vec2 p = abs(vUv * 2.0 - 1.0) - vec2(0.84, 0.88);
    float d = length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - 0.08;
    float edge = 1.0 - smoothstep(0.012, 0.035, abs(d + 0.025));
    if (edge < 0.01) discard;
    gl_FragColor = vec4(mix(uColor, vec3(1.0), uCharge * 0.25), edge * 0.8);
}`;

/** A quiet rim keeps the front legible. All elemental motion belongs to the particle pool. */
export function ElementCardMaterial({ suit, faceZ, front, charge }: {
    suit: TileSuit; faceZ: number; front: boolean; charge: number;
}) {
    const uniforms = useMemo(() => ({ uColor: { value: new Color(ELEMENT_CARD_MOTE[suit].tint) },
        uCharge: { value: Math.min(1, charge * 0.2) } }), [suit, charge]);
    return <group position={[0, 0, front ? faceZ : -faceZ]} rotation={[0, front ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0, 0.052]} raycast={noopMeshRaycast} renderOrder={11}>
            <planeGeometry args={[CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT]} />
            <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
                transparent depthWrite={false} toneMapped={false} />
        </mesh>
    </group>;
}
