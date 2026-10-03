import { useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4, type InstancedMesh } from 'three';
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
varying vec2 vUv;
void main() {
    vec2 p = vUv * 2.0 - 1.0;
    float edge = 1.0 - smoothstep(0.76, 1.0, max(abs(p.x), abs(p.y)));
    // Quiet footprint: the living material is emitted as particles above this cell.
    float rim = smoothstep(0.78, 0.84, max(abs(p.x), abs(p.y)));
    float alpha = edge * (0.045 + rim * 0.3);
    gl_FragColor = vec4(uColor, alpha);
}`;

function GroundMaterial({ suit }: { suit: TileSuit }) {
    const uniforms = useMemo(() => ({ uColor: { value: new Color(getTileSuit(suit).hue) } }), [suit]);
    return <shaderMaterial uniforms={uniforms} vertexShader={vertexShader} fragmentShader={fragmentShader}
        transparent depthWrite={false} toneMapped={false} />;
}

function GroundPatches({ board, suit, cells, compact, reduceMotion }: {
    board: BoardState; suit: TileSuit; cells: number[]; compact: boolean; reduceMotion: boolean;
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
