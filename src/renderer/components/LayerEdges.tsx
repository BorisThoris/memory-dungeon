import { useMemo } from 'react';
import { MeshBasicMaterial, PlaneGeometry } from 'three';
import type { BoardState } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { getTileTransform } from './tileBoardTransform';
import { CARD_PLANE_HEIGHT, CARD_PLANE_WIDTH } from './tileShatter';

/**
 * Layers (`board-layers-rules.ts`, DGE-017): under every cell that hides a second card, that card's
 * edge shows below and to the right of the card on top - plain ink with a paper rim, the same for
 * every card beneath, so it says only that something waits there, never what. It sits behind the top
 * card, follows its cell's layout, and is never picked. When the card rises the edge is gone.
 */
const EDGE_OFFSET = 0.06;
const EDGE_COLOR = '#1b2228';
const RIM_COLOR = '#d9c79c';

export function LayerEdges({ board, compact, reduceMotion }: { board: Pick<BoardState, 'beneath' | 'tiles' | 'columns' | 'rows'>; compact: boolean; reduceMotion: boolean }) {
    const cells = useMemo(
        () =>
            (board.beneath ?? []).flatMap((card, index) => {
                const top = board.tiles[index];
                if (!card || !top) return [];
                const transform = getTileTransform(top, index, board.columns, board.rows, compact, false, reduceMotion);
                return [{ index, x: transform.baseX + transform.layoutJitterX + EDGE_OFFSET, y: transform.baseY + transform.layoutJitterY - EDGE_OFFSET }];
            }),
        [board.beneath, board.columns, board.rows, board.tiles, compact, reduceMotion]
    );
    const rimGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.97, CARD_PLANE_HEIGHT * 0.97), []);
    const edgeGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.93, CARD_PLANE_HEIGHT * 0.94), []);
    const rimMaterial = useMemo(() => new MeshBasicMaterial({ color: RIM_COLOR, depthWrite: false }), []);
    const edgeMaterial = useMemo(() => new MeshBasicMaterial({ color: EDGE_COLOR, depthWrite: false }), []);
    if (cells.length === 0) return null;
    return (
        <group name="layer-edges">
            {cells.map(({ index, x, y }) => (
                <group key={index} position={[x, y, -0.018]}>
                    <mesh geometry={rimGeometry} material={rimMaterial} raycast={noopMeshRaycast} renderOrder={-12} />
                    <mesh geometry={edgeGeometry} material={edgeMaterial} position={[0, 0, 0.002]} raycast={noopMeshRaycast} renderOrder={-11} />
                </group>
            ))}
        </group>
    );
}
