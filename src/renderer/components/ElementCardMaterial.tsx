import { useMemo } from 'react';
import { Color } from 'three';
import type { TileSuit } from '../../shared/contracts';
import { ELEMENT_CARD_MOTE } from './realmParticles';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';
import { CARD_DISSOLVE_GLSL, CARD_DISSOLVE_THRESHOLD_GLSL, createCardDissolveUniforms, type CardDissolveUniforms } from './cardDissolveMaterial';

const vertexShader = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const fragmentShader = `uniform vec3 uColor; uniform float uCharge; varying vec2 vUv;
uniform float uDissolve; uniform float uDissolveStyle; uniform vec2 uDissolveSeed;
${CARD_DISSOLVE_GLSL}
void main() {
    vec2 p = abs(vUv * 2.0 - 1.0) - vec2(0.84, 0.88);
    float d = length(max(p, 0.0)) + min(max(p.x, p.y), 0.0) - 0.08;
    float aa = max(fwidth(d), 0.004);
    float edge = 1.0 - smoothstep(0.015 - aa, 0.015 + aa, abs(d + 0.025));
    if (edge < 0.01) discard;
    // The rim leaves with the card it edges (\`cardDissolveMaterial.ts\`).
    if (uDissolve > 0.0) {
        float crack;
        if (cardDissolveField(vUv, uDissolveStyle, uDissolveSeed, crack) < ${CARD_DISSOLVE_THRESHOLD_GLSL}) discard;
    }
    gl_FragColor = vec4(mix(uColor, vec3(1.0), uCharge * 0.25), edge * 0.8);
    #include <colorspace_fragment>
}`;

/** A quiet rim keeps the front legible. All elemental motion belongs to the particle pool. */
export function ElementCardMaterial({ suit, faceZ, front, charge, dissolve }: {
    suit: TileSuit; faceZ: number; front: boolean; charge: number;
    /** The card's dissolve, so the rim burns away with it; a rim of its own never dissolves. */
    dissolve?: CardDissolveUniforms;
}) {
    const own = useMemo(() => dissolve ?? createCardDissolveUniforms(suit), [dissolve, suit]);
    const uniforms = useMemo(() => ({ uColor: { value: new Color(ELEMENT_CARD_MOTE[suit].tint) },
        uCharge: { value: Math.min(1, charge * 0.2) },
        uDissolve: own.uDissolve, uDissolveStyle: own.uDissolveStyle, uDissolveSeed: own.uDissolveSeed }), [suit, charge, own]);
    return <group position={[0, 0, front ? faceZ : -faceZ]} rotation={[0, front ? 0 : Math.PI, 0]}>
        <mesh position={[0, 0, 0.052]} raycast={noopMeshRaycast} renderOrder={11}>
            <planeGeometry args={[CARD_PLANE_WIDTH, CARD_PLANE_HEIGHT]} />
            {/* Keyed on the element: a material takes its uniforms once, and a Turncoat's card changes element in place. */}
            <shaderMaterial key={suit} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
                transparent depthWrite={false} toneMapped={false} />
        </mesh>
    </group>;
}
