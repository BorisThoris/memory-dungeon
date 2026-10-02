import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Color, Matrix4, type InstancedMesh, type ShaderMaterial } from 'three';
import type { BoardState, TileSuit } from '../../shared/contracts';
import { readElementalGround } from '../../shared/element-ground-rules';
import { getTileSuit } from '../../shared/tile-suit-rules';
import { getTileTransform } from './tileBoardTransform';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

const SUITS: readonly TileSuit[] = ['ember', 'tide', 'bone', 'moss'];
const vertexShader = `
varying vec2 vUv;
void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`;
const fragmentShader = `
uniform vec3 uColor;
uniform float uKind;
uniform float uTime;
varying vec2 vUv;
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float edge = 1.0 - smoothstep(0.76, 1.0, max(abs(p.x), abs(p.y)));
    float pattern;
    if (uKind < 0.5) {
        // Split cinders: a cracked bed with embers moving through the seams.
        float crack = abs(sin(p.x * 11.0 + sin(p.y * 8.0)) * sin(p.y * 9.0 - p.x * 3.0));
        pattern = (1.0 - smoothstep(0.04, 0.16, crack)) * (0.7 + 0.3 * sin(uTime * 1.8 + p.y * 6.0));
    } else if (uKind < 1.5) {
        // Water: concentric moving ripples, distinct even without its colour.
        float ring = sin(length(p * vec2(1.0, 0.7)) * 26.0 - uTime * 1.5);
        pattern = smoothstep(0.65, 1.0, ring);
    } else if (uKind < 2.5) {
        // Ice: a still, faceted lattice. This ground is an anchor, never a card lock.
        float facet = min(abs(p.x - p.y * 0.65), min(abs(p.x + p.y * 0.65), abs(p.y)));
        pattern = 1.0 - smoothstep(0.015, 0.06, facet);
        pattern = max(pattern, (1.0 - smoothstep(0.025, 0.055, abs(abs(p.y) - 0.5))) * 0.5);
    } else {
        // Grove: branching roots with broad leaves, gently breathing.
        float stem = abs(p.x - sin(p.y * 6.0) * 0.18);
        float leaf = length(vec2((abs(p.x) - 0.3) * 2.8, fract((p.y + 1.0) * 2.0) - 0.5));
        pattern = max(1.0 - smoothstep(0.025, 0.07, stem), 1.0 - smoothstep(0.22, 0.38, leaf));
        pattern *= 0.85 + 0.15 * sin(uTime + p.y * 3.0);
    }
    float rim = smoothstep(0.63, 0.78, max(abs(p.x), abs(p.y)));
    float alpha = edge * (0.11 + pattern * 0.42 + rim * 0.15);
    gl_FragColor = vec4(uColor * (0.55 + pattern * 0.65), alpha);
}`;

function GroundMaterial({ suit, animated }: { suit: TileSuit; animated: boolean }) {
    const material = useRef<ShaderMaterial>(null);
    const uniforms = useMemo(() => ({ uColor: { value: new Color(getTileSuit(suit).hue) }, uKind: { value: SUITS.indexOf(suit) }, uTime: { value: 0 } }), [suit]);
    useFrame(({ clock }) => {
        if (material.current) material.current.uniforms.uTime!.value = animated ? clock.elapsedTime : 0;
    });
    return <shaderMaterial ref={material} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
        transparent depthWrite={false} toneMapped={false} />;
}

function GroundPatches({ board, suit, cells, compact, reduceMotion, animated }: {
    board: BoardState; suit: TileSuit; cells: number[]; compact: boolean; reduceMotion: boolean; animated: boolean;
}) {
    const mesh = useRef<InstancedMesh>(null);
    useLayoutEffect(() => {
        if (!mesh.current) return;
        const matrix = new Matrix4();
        cells.forEach((cell, instance) => {
            const pos = getTileTransform(board.tiles[cell]!, cell, board.columns, board.rows, compact, false, reduceMotion);
            matrix.makeTranslation(pos.baseX, pos.baseY, -0.055);
            mesh.current!.setMatrixAt(instance, matrix);
        });
        mesh.current.instanceMatrix.needsUpdate = true;
        mesh.current.computeBoundingSphere();
    }, [board, cells, compact, reduceMotion]);
    return <instancedMesh ref={mesh} args={[undefined, undefined, cells.length]} raycast={noopMeshRaycast} renderOrder={-10}>
        <planeGeometry args={[CARD_PLANE_WIDTH * 1.2, CARD_PLANE_HEIGHT * 1.13]} />
        <GroundMaterial suit={suit} animated={animated} />
    </instancedMesh>;
}

/** Four instanced draws at most, including empty cells. Ground never intercepts a card press. */
export function ElementGround({ board, compact, reduceMotion, lowQuality }: {
    board: BoardState; compact: boolean; reduceMotion: boolean; lowQuality: boolean;
}) {
    const patches = useMemo(() => {
        const ground = readElementalGround(board);
        return SUITS.map((suit) => ({ suit, cells: ground.flatMap((cell, index) => cell === suit ? [index] : []) }));
    }, [board]);
    return <group>{patches.filter(({ cells }) => cells.length > 0).map(({ suit, cells }) =>
        <GroundPatches key={suit} board={board} suit={suit} cells={cells} compact={compact} reduceMotion={reduceMotion} animated={!reduceMotion && !lowQuality} />
    )}</group>;
}
