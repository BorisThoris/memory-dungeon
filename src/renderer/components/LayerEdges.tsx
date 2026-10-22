import { CARD_BACK_INK } from './cardBackInk';
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
/** The element frame colours a charted edge takes (the theme's amber, cyan, emerald and ash). */
const CHART_EDGE: Readonly<Record<string, string>> = { ember: '#df8447', tide: '#63a5bb', moss: '#7dc26a', bone: '#bcb3a0' };

export function LayerEdges({ board, compact, reduceMotion }: { board: Pick<BoardState, 'beneath' | 'tiles' | 'columns' | 'rows'>; compact: boolean; reduceMotion: boolean }) {
    const cells = useMemo(
        () =>
            (board.beneath ?? []).flatMap((card, index) => {
                const top = board.tiles[index];
                if (!card || !top) return [];
                const transform = getTileTransform(top, index, board.columns, board.rows, compact, false, reduceMotion);
                return [{ index, suit: card.suit ?? null, x: transform.baseX + transform.layoutJitterX + EDGE_OFFSET, y: transform.baseY + transform.layoutJitterY - EDGE_OFFSET }];
            }),
        [board.beneath, board.columns, board.rows, board.tiles, compact, reduceMotion]
    );
    const rimGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.97, CARD_PLANE_HEIGHT * 0.97), []);
    const edgeGeometry = useMemo(() => new PlaneGeometry(CARD_PLANE_WIDTH * 0.93, CARD_PLANE_HEIGHT * 0.94), []);
    const rimMaterial = useMemo(() => new MeshBasicMaterial({ color: RIM_COLOR, depthWrite: false }), []);
    // The Cartographer's chart (`cartographer-rules.ts`): a charted card's edge is its element's frame colour,
    // and its rim the element's ink. A tinted rim alone read the same as the plain one (2026-10-22).
    const chartMaterials = useMemo(
        () => ({
            rim: Object.fromEntries(Object.entries(CARD_BACK_INK).map(([suit, ink]) => [suit, new MeshBasicMaterial({ color: ink, depthWrite: false })])) as Record<string, MeshBasicMaterial>,
            edge: Object.fromEntries(Object.entries(CHART_EDGE).map(([suit, color]) => [suit, new MeshBasicMaterial({ color, depthWrite: false })])) as Record<string, MeshBasicMaterial>
        }),
        []
    );
    const edgeMaterial = useMemo(() => new MeshBasicMaterial({ color: EDGE_COLOR, depthWrite: false }), []);
    if (cells.length === 0) return null;
    return (
        <group name="layer-edges">
            {cells.map(({ index, suit, x, y }) => (
                <group key={index} position={[x, y, -0.018]}>
                    <mesh geometry={rimGeometry} material={(suit && chartMaterials.rim[suit]) || rimMaterial} raycast={noopMeshRaycast} renderOrder={-12} />
                    <mesh geometry={edgeGeometry} material={(suit && chartMaterials.edge[suit]) || edgeMaterial} position={[0, 0, 0.002]} raycast={noopMeshRaycast} renderOrder={-11} />
                </group>
            ))}
        </group>
    );
}
