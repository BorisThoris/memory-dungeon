import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, type InstancedMesh } from 'three';
import type { BoardState, TileSuit } from '../../shared/contracts';
import { readElementalGround } from '../../shared/element-ground-rules';
import { getTileSuit } from '../../shared/tile-suit-rules';
import { getTileTransform } from './tileBoardTransform';
import { TILE_SPACING, getTileColumnSpacing } from './tileShatter';
import { noopMeshRaycast } from './tileBoardPick';

const SUITS: readonly TileSuit[] = ['ember', 'tide', 'bone', 'moss'];
const vertexShader = `
attribute vec4 neighbours;
varying vec2 vUv;
varying vec2 vWorld;
varying vec4 vNeighbours;
void main() {
    vUv = uv;
    vNeighbours = neighbours;
    vec4 world = instanceMatrix * vec4(position, 1.0);
    vWorld = world.xy;
    gl_Position = projectionMatrix * modelViewMatrix * world;
}`;
const fragmentShader = `
uniform vec3 uColor;
uniform float uKind;
varying vec2 vUv;
varying vec2 vWorld;
varying vec4 vNeighbours;
float line(float d, float width) { return 1.0 - smoothstep(width, width + max(fwidth(d), 0.008), abs(d)); }
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    // Shared edges open into adjacent cells of the same material. An outer shore remains visible.
    vec4 bounds = vec4(1.0 + p.x, 1.0 - p.x, 1.0 + p.y, 1.0 - p.y);
    bounds += vNeighbours * 2.0;
    float shore = min(min(bounds.x, bounds.y), min(bounds.z, bounds.w));
    float mask = smoothstep(0.0, 0.13, shore);
    float rim = line(shore - 0.12, 0.035);
    vec2 q = vWorld * 5.0;
    float pattern = 0.0;
    vec3 color = uColor;
    if (uKind < 0.5) {
        // Cinders: branching fissures, with bright seams and a charred field.
        float crack = sin(q.x * 2.3 + sin(q.y * 1.7)) * sin(q.y * 1.9 + cos(q.x));
        pattern = line(crack, 0.035);
        color = mix(uColor * 0.38, vec3(1.0, 0.35, 0.04), pattern);
    } else if (uKind < 1.5) {
        // Pools: continuous contour lines across the whole wet patch.
        float wave = sin(q.y * 2.4 + sin(q.x * 0.8) * 1.2);
        pattern = line(wave, 0.08);
        color = mix(uColor, vec3(0.2, 0.65, 0.9), 0.5);
    } else if (uKind < 2.5) {
        // Ice: angular facets and fine fracture lines.
        vec2 cell = fract(q * 0.6);
        pattern = max(line(cell.x - cell.y, 0.025), line(cell.x + cell.y - 1.0, 0.02));
        color = mix(uColor * 0.6, vec3(0.78, 0.93, 1.0), step(cell.y, cell.x) * 0.5);
    } else {
        // Roots: a woody winding stem and shorter branches, never a flat green wash.
        float stem = sin(q.y * 0.9) * 0.6;
        pattern = max(line(sin(q.x + stem), 0.055), line(sin(q.x * 1.6 - q.y * 1.5), 0.035) * 0.6);
        color = mix(uColor * 0.45, uColor, pattern);
    }
    // Ground supports the card silhouette; its small-scale detail must not rival status marks.
    float alpha = mask * (0.07 + pattern * 0.13 + rim * 0.20);
    if (alpha < 0.01) discard;
    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
}`;

function GroundMaterial({ suit }: { suit: TileSuit }) {
    const uniforms = useMemo(() => ({ uColor: { value: new Color(getTileSuit(suit).hue) }, uKind: { value: SUITS.indexOf(suit) } }), [suit]);
    return <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
        transparent depthWrite={false} toneMapped={false} />;
}

function GroundPatches({ board, suit, cells, compact, reduceMotion }: {
    board: BoardState; suit: TileSuit; cells: number[]; compact: boolean; reduceMotion: boolean;
}) {
    const mesh = useRef<InstancedMesh>(null);
    const neighbours = useMemo(() => {
        const occupied = new Set(cells);
        return new Float32Array(cells.flatMap(cell => [
            cell % board.columns > 0 && occupied.has(cell - 1) ? 1 : 0,
            cell % board.columns < board.columns - 1 && occupied.has(cell + 1) ? 1 : 0,
            occupied.has(cell + board.columns) ? 1 : 0,
            occupied.has(cell - board.columns) ? 1 : 0
        ]));
    }, [cells, board.columns]);
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
        <planeGeometry args={[getTileColumnSpacing(compact) * 1.04, TILE_SPACING * 1.04]}>
            <instancedBufferAttribute attach="attributes-neighbours" args={[neighbours, 4]} />
        </planeGeometry>
        <GroundMaterial suit={suit} />
    </instancedMesh>;
}

/** Four instanced draws at most, including empty cells. Ground never intercepts a card press. */
export function ElementGround({ board, compact, reduceMotion }: {
    board: BoardState; compact: boolean; reduceMotion: boolean;
}) {
    const patches = useMemo(() => {
        const ground = readElementalGround(board);
        return SUITS.map((suit) => ({ suit, cells: ground.flatMap((cell, index) => cell === suit ? [index] : []) }));
    }, [board]);
    return <group>{patches.filter(({ cells }) => cells.length > 0).map(({ suit, cells }) =>
        <GroundPatches key={suit} board={board} suit={suit} cells={cells} compact={compact} reduceMotion={reduceMotion} />
    )}</group>;
}
