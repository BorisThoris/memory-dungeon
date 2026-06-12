import type { Tile } from '../../shared/contracts';
import {
    BOARD_LAYOUT_JITTER_XY,
    BOARD_LAYOUT_JITTER_Z,
    BOARD_LAYOUT_ROW_STAGGER_X,
    BOARD_LAYOUT_YAW_MAX,
    CORE_SCALE,
    SHELL_SCALE,
    TILE_SPACING
} from './tileShatter';

export interface TileTransform {
    baseX: number;
    baseY: number;
    baseScale: number;
    bezelScale: number;
    panelScale: number;
    imperfectionRotationX: number;
    imperfectionRotationZ: number;
    imperfectionX: number;
    imperfectionY: number;
    flipRotationY: number;
    layoutJitterX: number;
    layoutJitterY: number;
    layoutJitterZ: number;
    layoutYaw: number;
    seed: number;
}

export const hashTileLayoutSeed = (value: string): number => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
};

export const layoutNormFromSeed = (seed: number, shift: number): number =>
    (((seed >>> shift) % 1001) / 500) - 1;

export const getTileTransform = (
    tile: Tile,
    index: number,
    totalColumns: number,
    totalRows: number,
    compact: boolean,
    faceUp: boolean,
    reduceMotion: boolean
): TileTransform => {
    const seed = hashTileLayoutSeed(tile.id);
    const column = index % totalColumns;
    const row = Math.floor(index / totalColumns);
    const compactMul = compact ? 0.85 : 1;
    let baseX = (column - (totalColumns - 1) / 2) * TILE_SPACING;
    if (!reduceMotion && row % 2 === 1) {
        baseX += BOARD_LAYOUT_ROW_STAGGER_X * compactMul;
    }
    const baseY = ((totalRows - 1) / 2 - row) * TILE_SPACING;
    const imperfectionX = (((seed % 19) - 9) * 0.0025) / (compact ? 1.2 : 1);
    const imperfectionY = ((((seed >> 3) % 19) - 9) * 0.0024) / (compact ? 1.2 : 1);
    const imperfectionRotationX = (((seed >> 5) % 11) - 5) * 0.0028;
    const imperfectionRotationZ = (((seed >> 7) % 11) - 5) * 0.0026;
    const baseScale = 0.968 + ((seed % 7) * 0.0018);
    const bezelScale = SHELL_SCALE + ((seed % 5) * 0.0028);
    const panelScale = CORE_SCALE + ((seed % 5) * 0.002);
    const flipRotationY = faceUp ? 0 : Math.PI;
    const layoutJitterX =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 11) * BOARD_LAYOUT_JITTER_XY * compactMul;
    const layoutJitterY =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 17) * BOARD_LAYOUT_JITTER_XY * compactMul;
    const layoutJitterZ =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 23) * BOARD_LAYOUT_JITTER_Z * compactMul;
    const layoutYaw =
        reduceMotion ? 0 : layoutNormFromSeed(seed, 29) * BOARD_LAYOUT_YAW_MAX * compactMul;

    return {
        baseScale,
        baseX,
        baseY,
        bezelScale,
        flipRotationY,
        imperfectionRotationX,
        imperfectionRotationZ,
        imperfectionX,
        imperfectionY,
        layoutJitterX,
        layoutJitterY,
        layoutJitterZ,
        layoutYaw,
        panelScale,
        seed
    };
};
