import type { BoardState } from '../../shared/contracts';
import { getTileTransform } from './tileBoardTransform';

// Where the Spiral's sealed slabs sit and how they settle (`SpiralSeals.tsx`).

/** Seconds a slab takes to settle when its ring seals. */
export const SEAL_SETTLE_SECONDS = 0.5;

/** Where each sealed cell's slab sits. */
export const sealedSlabCells = (
    board: Pick<BoardState, 'tiles' | 'columns' | 'rows'>,
    compact: boolean,
    reduceMotion: boolean
): Array<{ index: number; x: number; y: number }> =>
    board.tiles.flatMap((tile, index) => {
        if (!tile.sealed) return [];
        const transform = getTileTransform(tile, index, board.columns, board.rows, compact, false, reduceMotion);
        return [{ index, x: transform.baseX + transform.layoutJitterX, y: transform.baseY + transform.layoutJitterY }];
    });

/** A slab's scale while it settles: from a little larger down to its place, eased out. */
export const sealSettleScale = (secondsSinceSeal: number, reduceMotion: boolean): number => {
    if (reduceMotion) return 1;
    const t = Math.min(1, Math.max(0, secondsSinceSeal / SEAL_SETTLE_SECONDS));
    return 1 + 0.18 * (1 - t) * (1 - t);
};

/** Where each held pair's cards were (`hold-rules.ts`): the Hold's seeds, waiting for the release. */
export const heldSeedCells = (
    board: Pick<BoardState, 'tiles' | 'columns' | 'rows'>,
    heldSeedIds: readonly string[] | null | undefined,
    compact: boolean,
    reduceMotion: boolean
): Array<{ index: number; x: number; y: number }> => {
    const held = new Set(heldSeedIds ?? []);
    if (held.size === 0) return [];
    return board.tiles.flatMap((tile, index) => {
        if (!held.has(tile.id)) return [];
        const transform = getTileTransform(tile, index, board.columns, board.rows, compact, false, reduceMotion);
        return [{ index, x: transform.baseX + transform.layoutJitterX, y: transform.baseY + transform.layoutJitterY }];
    });
};

/**
 * How bright the Hold's seeds burn: a slow breath whose floor rises with every pair held and never
 * tops out below full (AGENTS.md: what the Hold drives climbs without end). Still with reduced motion.
 */
export const holdSeedGlow = (seconds: number, heldPairs: number, reduceMotion: boolean): number => {
    const base = 1 - 0.6 / (1 + Math.log2(1 + Math.max(0, heldPairs)));
    if (reduceMotion) return base;
    return base * (0.75 + 0.25 * Math.sin(seconds * 2.4));
};
