import { useMemo } from 'react';
import { CircleGeometry, MeshBasicMaterial, PlaneGeometry } from 'three';
import type { BoardState } from '../../shared/contracts';
import { noopMeshRaycast } from './tileBoardPick';
import { getTileColumnSpacing, TILE_SPACING } from './tileShatter';

/**
 * The Fold's wall (`board-fold-rules.ts`, DGE-010): a strip of stone in the gap between the two
 * rooms' columns, row by row, left open on the doorway's rows with a post either side of the opening.
 * It sits behind the cards and is never picked. A shape, not a colour: the gap in it is the door.
 */
const WALL_WIDTH = 0.07;
const POST_RADIUS = 0.06;
const WALL_COLOR = '#c9a86a';
const POST_COLOR = '#f1d79a';

const foldWallSegments = (
    board: Pick<BoardState, 'columns' | 'rows' | 'fold'>,
    compact: boolean
): { walls: Array<[number, number]>; posts: Array<[number, number]> } => {
    const fold = board.fold;
    if (!fold) return { walls: [], posts: [] };
    const x = (fold.afterColumn + 0.5 - (board.columns - 1) / 2) * getTileColumnSpacing(compact);
    const rowY = (row: number): number => ((board.rows - 1) / 2 - row) * TILE_SPACING;
    const walls: Array<[number, number]> = [];
    const posts: Array<[number, number]> = [];
    for (let row = 0; row < board.rows; row += 1) {
        const open = fold.doorRows.includes(row);
        if (!open) walls.push([x, rowY(row)]);
        // A post where the wall meets the opening, above and below the doorway.
        if (open && !fold.doorRows.includes(row - 1)) posts.push([x, rowY(row) + TILE_SPACING / 2]);
        if (open && !fold.doorRows.includes(row + 1)) posts.push([x, rowY(row) - TILE_SPACING / 2]);
    }
    return { walls, posts };
};

export function FoldWall({ board, compact }: { board: Pick<BoardState, 'columns' | 'rows' | 'fold'>; compact: boolean }) {
    const { walls, posts } = useMemo(() => foldWallSegments(board, compact), [board, compact]);
    const wallGeometry = useMemo(() => new PlaneGeometry(WALL_WIDTH, TILE_SPACING), []);
    const postGeometry = useMemo(() => new CircleGeometry(POST_RADIUS, 20), []);
    const wallMaterial = useMemo(() => new MeshBasicMaterial({ color: WALL_COLOR, transparent: true, opacity: 0.85, depthWrite: false }), []);
    const postMaterial = useMemo(() => new MeshBasicMaterial({ color: POST_COLOR, depthWrite: false }), []);
    if (!board.fold) return null;
    return (
        <group name="fold-wall">
            {walls.map(([x, y]) => (
                <mesh key={`wall-${y}`} geometry={wallGeometry} material={wallMaterial} position={[x, y, -0.05]} raycast={noopMeshRaycast} renderOrder={-10} />
            ))}
            {posts.map(([x, y]) => (
                <mesh key={`post-${y}`} geometry={postGeometry} material={postMaterial} position={[x, y, -0.045]} raycast={noopMeshRaycast} renderOrder={-9} />
            ))}
        </group>
    );
}
