import { DoubleSide, Mesh, type Intersection, type Raycaster } from 'three';
import type { Tile } from '../../shared/contracts';

/**
 * Row-major linear index for `BoardState.tiles` — must match `game.ts` and keyboard nav in `TileBoard`
 * (`Math.floor(index / columns)`, `index % columns`).
 */
export const linearBoardIndexFromRowCol = (columns: number, row: number, col: number): number => row * columns + col;

export const rowColFromLinearBoardIndex = (
    columns: number,
    index: number
): { row: number; col: number } => ({
    row: Math.floor(index / columns),
    col: index % columns
});

/** Raycast hook that never records an intersection (overlay / background meshes). */
export const noopMeshRaycast: Mesh['raycast'] = () => undefined;

/**
 * Hidden cards are rotated π around Y; the face the camera sees is often the geometric "back" of each triangle.
 * Rendering uses FrontSide, so Mesh.raycast would miss — temporarily use DoubleSide only for picking.
 */
export const pickableMeshRaycast: Mesh['raycast'] = function pickableMeshRaycast(
    this: Mesh,
    raycaster: Raycaster,
    intersects: Intersection[]
): void {
    const { material } = this;

    if (Array.isArray(material)) {
        const sides = material.map((m) => m.side);

        try {
            material.forEach((m) => {
                m.side = DoubleSide;
            });
            Mesh.prototype.raycast.call(this, raycaster, intersects);
        } finally {
            material.forEach((m, i) => {
                m.side = sides[i];
            });
        }

        return;
    }

    const prevSide = material.side;

    try {
        material.side = DoubleSide;
        Mesh.prototype.raycast.call(this, raycaster, intersects);
    } finally {
        material.side = prevSide;
    }
};

export const isTilePickable = (tile: Tile, interactive: boolean, flipLocked: boolean): boolean => {
    // A card that has left the board takes its hit target with it. Removed tiles play a burst and
    // then scale away to nothing, so leaving them pickable left invisible buttons behind wherever
    // a trap sprang, a lever was thrown, or a chunk broke.
    if (tile.state === 'matched' || tile.state === 'removed') {
        return false;
    }

    if (!interactive) {
        return false;
    }

    if (flipLocked && tile.state === 'hidden') {
        return false;
    }

    return true;
};
