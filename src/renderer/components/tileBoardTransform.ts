import type { Tile } from '../../shared/contracts';
import {
    BOARD_LAYOUT_JITTER_XY,
    BOARD_LAYOUT_JITTER_Z,
    BOARD_LAYOUT_ROW_STAGGER_X,
    BOARD_LAYOUT_YAW_MAX,
    CORE_SCALE,
    getTileColumnSpacing,
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

/**
 * A card's private seed: its layout jitter, tilt, idle sway, glow and sparks all read it.
 *
 * The ids of a pair's two halves differ only in their last character (`${pairKey}-A`, `-B`), and a
 * plain `*31` string hash left their seeds exactly one apart. Everything shifted or taken modulo
 * from that seed came out nearly the same for both halves, so a pair bobbed in step, sat at the
 * same tilt and glinted alike while every other card was out of step: a tell that gave the pair
 * away before either card was turned (2026-10-08 audit). The string hash is now finished with an
 * avalanche mix (murmur3's fmix32), so ids one character apart get unrelated seeds.
 */
export const hashTileLayoutSeed = (value: string): number => {
    let hash = 0;

    for (let index = 0; index < value.length; index += 1) {
        hash = (hash * 31 + value.charCodeAt(index)) | 0;
    }

    hash ^= hash >>> 16;
    hash = Math.imul(hash, 0x85ebca6b);
    hash ^= hash >>> 13;
    hash = Math.imul(hash, 0xc2b2ae35);
    hash ^= hash >>> 16;
    // Non-negative and under 2^31, as every consumer of the seed expects.
    return hash >>> 1;
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
    let baseX = (column - (totalColumns - 1) / 2) * getTileColumnSpacing(compact);
    if (!reduceMotion && totalRows > 1) {
        // Balance both sides of the camera instead of shifting half the deal to the right.
        baseX += (row % 2 === 1 ? 0.5 : -0.5) * BOARD_LAYOUT_ROW_STAGGER_X * compactMul;
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
