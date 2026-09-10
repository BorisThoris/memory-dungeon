import type { Tile, TileTraitKind } from '../../shared/contracts';
import { isTilePickable } from './tileBoardPick';

export type TileBoardPowerBackAccent =
    | 'peek'
    | 'pin'
    | 'swap'
    | 'swapOrigin'
    | 'clump'
    | 'clumpNext';

interface TileBoardHiddenBackAccents {
    nonPickableBack: boolean;
    powerBackAccent: TileBoardPowerBackAccent | null;
    traitBackAccent: TileTraitKind | null;
}

export interface TileBoardHiddenBackAccentsInput {
    /** What a match on the considered tile takes now; outlined so the read is on the board, not only in a chip. */
    clumpReadTileIds?: ReadonlySet<string>;
    /** What the next rung would add on top of that: the ghost, so the hold decision is visible (thesis §30.3b). */
    clumpReadNextTileIds?: ReadonlySet<string>;
    faceUp: boolean;
    flipLocked: boolean;
    interactive: boolean;
    peekEligibleTileIds: ReadonlySet<string>;
    peekPowerVisualActive: boolean;
    pinModeBoardHintActive: boolean;
    tileSwapEligibleTileIds: ReadonlySet<string>;
    tileSwapFirstTileId: string | null;
    tileSwapPowerVisualActive: boolean;
    tile: Tile;
}

export const getTileBoardHiddenBackAccents = ({
    clumpReadNextTileIds,
    clumpReadTileIds,
    faceUp,
    flipLocked,
    interactive,
    peekEligibleTileIds,
    peekPowerVisualActive,
    pinModeBoardHintActive,
    tileSwapEligibleTileIds,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive,
    tile
}: TileBoardHiddenBackAccentsInput): TileBoardHiddenBackAccents => {
    if (tile.state !== 'hidden' || faceUp) {
        return {
            nonPickableBack: false,
            powerBackAccent: null,
            traitBackAccent: null
        };
    }

    let powerBackAccent: TileBoardPowerBackAccent | null = null;
    if (pinModeBoardHintActive) {
        powerBackAccent = 'pin';
    } else if (tileSwapPowerVisualActive && tileSwapFirstTileId === tile.id) {
        powerBackAccent = 'swapOrigin';
    } else if (tileSwapPowerVisualActive && tileSwapEligibleTileIds.has(tile.id)) {
        powerBackAccent = 'swap';
    } else if (peekPowerVisualActive && peekEligibleTileIds.has(tile.id)) {
        powerBackAccent = 'peek';
    } else if (clumpReadTileIds?.has(tile.id)) {
        // Lowest priority: a power that is armed always outranks a read.
        powerBackAccent = 'clump';
    } else if (clumpReadNextTileIds?.has(tile.id)) {
        // The ghost sits under the solid read: this one does not go yet, it goes at the next rung.
        powerBackAccent = 'clumpNext';
    }

    return {
        nonPickableBack: !isTilePickable(tile, interactive, flipLocked),
        powerBackAccent,
        traitBackAccent: tile.tileTraitKind ?? null
    };
};
