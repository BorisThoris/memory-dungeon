import type { HazardTileKind, Tile, TileTraitKind } from '../../shared/contracts';
import { DECOY_PAIR_KEY } from '../../shared/tile-identity';
import { isTilePickable } from './tileBoardPick';

export type TileBoardPowerBackAccent = 'destroy' | 'peek' | 'stray' | 'pin' | 'swap' | 'swapOrigin' | 'clump';

interface TileBoardHiddenBackAccents {
    destroyBlockedDecoyBack: boolean;
    hazardBackAccent: HazardTileKind | null;
    nonPickableBack: boolean;
    objectiveBackAccent: boolean;
    powerBackAccent: TileBoardPowerBackAccent | null;
    routeBackAccent: boolean;
    traitBackAccent: TileTraitKind | null;
}

export interface TileBoardHiddenBackAccentsInput {
    /** The clump the focused or selected tile stands in; outlined so the read is on the board, not only in a chip. */
    clumpReadTileIds?: ReadonlySet<string>;
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
            hazardBackAccent: null,
            nonPickableBack: false,
            objectiveBackAccent: false,
            powerBackAccent: null,
            routeBackAccent: false,
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
    }

    return {
        destroyBlockedDecoyBack,
        hazardBackAccent: tile.tileHazardKind ?? null,
        nonPickableBack: !isTilePickable(tile, interactive, flipLocked),
        objectiveBackAccent: Boolean(tile.dungeonCardKind || tile.dungeonBossId),
        powerBackAccent,
        routeBackAccent: Boolean(tile.routeSpecialKind || tile.routeCardKind),
        traitBackAccent: tile.tileTraitKind ?? null
    };
};
