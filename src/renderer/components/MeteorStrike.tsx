import { useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, ShaderMaterial, type Mesh } from 'three';
import type { BoardState } from '../../shared/contracts';
import { getTileColumnSpacing, TILE_SPACING } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

const DURATION = 1.65;
const fragmentShader = /* glsl */ `
precision highp float;
varying vec2 p;
uniform float age;
uniform float calm;
void main() {
    float d = length(p);
    float impactAge = max(0., age - .16);
    float arrival = smoothstep(.09, .18, age);
    float fade = exp(-impactAge * 3.4) * (1. - smoothstep(1.2, 1.65, age));
    float flash = exp(-d * d * 28.) * fade * arrival;
    float ringRadius = calm > .5 ? .34 : .12 + .72 * (1. - exp(-impactAge * 3.));
    float ringDistance = abs(d - ringRadius);
    float aa = max(fwidth(d), .004);
    float ring = (1. - smoothstep(.008, .008 + aa * 1.5, ringDistance)) * fade * arrival;
    float halo = exp(-ringDistance * 35.) * fade * arrival * .18;
    float sparks = 0.;
    float trail = 0.;
    if (calm < .5) {
        float angle = atan(p.y, p.x);
        float rays = pow(max(0., sin(angle * 17. + sin(angle * 7.) * 1.4)), 24.);
        sparks = rays * exp(-abs(d - impactAge * .68 - .12) * 48.) * fade * arrival;
        vec2 head = vec2(-.55, .9) * pow(max(0., 1. - age / .18), 1.6);
        vec2 tail = head + vec2(-.2, .34);
        vec2 line = head - tail;
        float t = clamp(dot(p - tail, line) / dot(line, line), 0., 1.);
        float distance = length(p - (tail + line * t));
        trail = (exp(-distance * 100.) + exp(-distance * 30.) * .22) * t * (1. - smoothstep(.12, .2, age));
    }
    // Calm mode is a stationary acknowledgement, without a traveling streak or ring.
    float strength = calm > .5 ? .45 : 1.;
    float alpha = clamp((flash * .7 + ring * .65 + halo + sparks * .6 + trail) * strength, 0., .88);
    alpha *= 1. - smoothstep(.86, 1., d);
    if (alpha < .003) discard;
    vec3 fire = mix(vec3(1., .16, .025), vec3(1., .78, .32), clamp(flash + trail, 0., 1.));
    gl_FragColor = vec4(fire, alpha);
    #include <colorspace_fragment>
}`;

/** One pause-aware impact plane; it stops drawing when the final ember fades. */
export function MeteorStrike({ board, compact, reduceMotion, time }: {
    board: BoardState; compact: boolean; reduceMotion: boolean; time: MutableRefObject<number>;
}) {
    const started = useRef<number | null>(null);
    const mesh = useRef<Mesh>(null);
    const material = useMemo(() => new ShaderMaterial({
        transparent: true, depthWrite: false, depthTest: false, blending: AdditiveBlending, toneMapped: false,
        uniforms: { age: { value: 0 }, calm: { value: reduceMotion ? 1 : 0 } },
        vertexShader: 'varying vec2 p; void main(){p=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader
    }), [reduceMotion]);
    useEffect(() => () => material.dispose(), [material]);
    useFrame(() => {
        started.current ??= time.current;
        const age = time.current - started.current;
        material.uniforms.age!.value = age;
        if (mesh.current) mesh.current.visible = age < DURATION;
    });
    const impact = board.meteorImpact!;
    const x = (impact.cell % board.columns - (board.columns - 1) / 2) * getTileColumnSpacing(compact);
    const y = ((board.rows - 1) / 2 - Math.floor(impact.cell / board.columns)) * TILE_SPACING;
    const size = (impact.radius + 1) * TILE_SPACING * 2.4;
    return <mesh ref={mesh} position={[x, y, .4]} material={material} raycast={noopMeshRaycast} renderOrder={90}>
        <planeGeometry args={[size, size]} />
    </mesh>;
}
