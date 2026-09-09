import type { Tile, TileTraitKind } from '../../shared/contracts';
import { DECOY_PAIR_KEY } from '../../shared/tile-identity';
import { isTilePickable } from './tileBoardPick';

export type TileBoardPowerBackAccent =
    | 'destroy'
    | 'peek'
    | 'stray'
    | 'pin'
    | 'swap'
    | 'swapOrigin'
    | 'clump'
    | 'clumpNext';

interface TileBoardHiddenBackAccents {
    destroyBlockedDecoyBack: boolean;
    nonPickableBack: boolean;
    powerBackAccent: TileBoardPowerBackAccent | null;
    traitBackAccent: TileTraitKind | null;
}

export interface TileBoardHiddenBackAccentsInput {
    /** What a match on the considered tile takes now; outlined so the read is on the board, not only in a chip. */
    clumpReadTileIds?: ReadonlySet<string>;
    /** What the next rung would add on top of that: the ghost, so the hold decision is visible (thesis §30.3b). */
    clumpReadNextTileIds?: ReadonlySet<string>;
    destroyEligibleTileIds: ReadonlySet<string>;
    destroyPowerVisualActive: boolean;
    faceUp: boolean;
    flipLocked: boolean;
    interactive: boolean;
    peekEligibleTileIds: ReadonlySet<string>;
    peekPowerVisualActive: boolean;
    pinModeBoardHintActive: boolean;
    strayEligibleTileIds: ReadonlySet<string>;
    strayPowerVisualActive: boolean;
    tileSwapEligibleTileIds: ReadonlySet<string>;
    tileSwapFirstTileId: string | null;
    tileSwapPowerVisualActive: boolean;
    tile: Tile;
}

export const getTileBoardHiddenBackAccents = ({
    clumpReadNextTileIds,
    clumpReadTileIds,
    destroyEligibleTileIds,
    destroyPowerVisualActive,
    faceUp,
    flipLocked,
    interactive,
    peekEligibleTileIds,
    peekPowerVisualActive,
    pinModeBoardHintActive,
    strayEligibleTileIds,
    strayPowerVisualActive,
    tileSwapEligibleTileIds,
    tileSwapFirstTileId,
    tileSwapPowerVisualActive,
    tile
}: TileBoardHiddenBackAccentsInput): TileBoardHiddenBackAccents => {
    const destroyBlockedDecoyBack =
        destroyPowerVisualActive && !faceUp && tile.state === 'hidden' && tile.pairKey === DECOY_PAIR_KEY;

    if (tile.state !== 'hidden' || faceUp) {
        return {
            destroyBlockedDecoyBack,
            nonPickableBack: false,
            powerBackAccent: null,
            traitBackAccent: null
        };
    }

    let powerBackAccent: TileBoardPowerBackAccent | null = null;
    if (pinModeBoardHintActive) {
        powerBackAccent = 'pin';
    } else if (destroyBlockedDecoyBack) {
        powerBackAccent = null;
    } else if (destroyPowerVisualActive && destroyEligibleTileIds.has(tile.id)) {
        powerBackAccent = 'destroy';
    } else if (tileSwapPowerVisualActive && tileSwapFirstTileId === tile.id) {
        powerBackAccent = 'swapOrigin';
    } else if (tileSwapPowerVisualActive && tileSwapEligibleTileIds.has(tile.id)) {
        powerBackAccent = 'swap';
    } else if (peekPowerVisualActive && peekEligibleTileIds.has(tile.id)) {
        powerBackAccent = 'peek';
    } else if (strayPowerVisualActive && strayEligibleTileIds.has(tile.id)) {
        powerBackAccent = 'stray';
    } else if (clumpReadTileIds?.has(tile.id)) {
        // Lowest priority: a power that is armed always outranks a read.
        powerBackAccent = 'clump';
    } else if (clumpReadNextTileIds?.has(tile.id)) {
        // The ghost sits under the solid read: this one does not go yet, it goes at the next rung.
        powerBackAccent = 'clumpNext';
    }

    return {
        destroyBlockedDecoyBack,
        nonPickableBack: !isTilePickable(tile, interactive, flipLocked),
        powerBackAccent,
        traitBackAccent: tile.tileTraitKind ?? null
    };
};
