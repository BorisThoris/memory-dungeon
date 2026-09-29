import type { BoardState, Tile } from '../../shared/contracts';
import { getSafeBoardColumns } from '../../shared/board-grid-dimensions';
import { createMulberry32 } from '../../shared/rng';
import { particleBoardChanged } from './boardParticleCues';
import { getBreakWaveDelaySec } from './tileBoardBreakWave';
import { MATCH_CONTACT_SECONDS } from './boardMatchImpact';

/**
 * Group lightning: a match arcs between its two cards, and every card its break takes is struck
 * by a bolt from the nearest card already hit, so a clump reads as one charge running through a
 * group rather than as separate pops. The bolts land on the break wave's own beat, so the arc and
 * the card's burst are one event.
 */
export interface GroupArcCue {
    fromTileId: string;
    toTileId: string;
    /** Seconds after the committed board change the bolt strikes. */
    delay: number;
    /** A matched pair's own arc, or a bolt into a card its group broke. */
    kind: 'pair' | 'group';
}

/** Leads the burst slightly, so the bolt is seen arriving rather than trailing its own impact. */
export const GROUP_ARC_LEAD_SECONDS = 0.05;

/**
 * How hard the combo drives the board's effects, 0..1.
 *
 * Saturating rather than linear: the first few links are where the growth is felt, and a combo
 * carried across five floors should still have somewhere left to climb. 3 links ≈ 0.28, 6 ≈ 0.49,
 * 10 ≈ 0.67, 20 ≈ 0.89.
 */
export const comboEffectIntensity = (combo: number): number => {
    const links = Number.isFinite(combo) ? Math.max(0, combo) : 0;
    return 1 - Math.exp(-links / 9);
};

const gridCell = (index: number, columns: number) => ({ row: Math.floor(index / columns), col: index % columns });

/** Compare committed boards, like the burst cues: nothing replays on mount, pause or restore. */
export const collectGroupArcCues = (before: BoardState | null, board: BoardState): GroupArcCue[] => {
    if (particleBoardChanged(before, board)) return [];
    const previous = new Map(before!.tiles.map((tile) => [tile.id, tile]));
    const columns = getSafeBoardColumns(board);
    const fresh = (tile: Tile): boolean => {
        const old = previous.get(tile.id);
        return !!old && old.state !== tile.state && old.state !== 'matched' && old.state !== 'removed';
    };
    const indexed = board.tiles.map((tile, index) => ({ tile, index }));
    const matched = indexed.filter(({ tile }) => tile.state === 'matched' && fresh(tile));
    if (matched.length === 0) return [];
    const broken = indexed
        .filter(({ tile }) => tile.state === 'removed' && tile.brokenByChunk && fresh(tile))
        .map((entry) => ({ ...entry, delay: getBreakWaveDelaySec(board, entry.tile) }))
        .sort((a, b) => a.delay - b.delay || a.index - b.index);

    const cues: GroupArcCue[] = [];
    for (let index = 1; index < matched.length; index += 1) {
        cues.push({ fromTileId: matched[index - 1]!.tile.id, toTileId: matched[index]!.tile.id, delay: MATCH_CONTACT_SECONDS, kind: 'pair' });
    }
    const struck = [...matched];
    for (const target of broken) {
        const at = gridCell(target.index, columns);
        const distance = (entry: { index: number }) => {
            const cell = gridCell(entry.index, columns);
            return Math.abs(cell.row - at.row) + Math.abs(cell.col - at.col);
        };
        // Same suit first: the charge runs through the clump. A Fever bridge into a neighbouring
        // suit has no same-suit source, and takes its bolt from whatever was struck nearest.
        const sameSuit = struck.filter(({ tile }) => tile.suit && tile.suit === target.tile.suit);
        const pool = sameSuit.length > 0 ? sameSuit : struck;
        let source = pool[0]!;
        for (const candidate of pool) if (distance(candidate) < distance(source)) source = candidate;
        cues.push({ fromTileId: source.tile.id, toTileId: target.tile.id, delay: Math.max(0, target.delay - GROUP_ARC_LEAD_SECONDS), kind: 'group' });
        struck.push(target);
    }
    return cues;
};

/**
 * A jagged bolt from (x0, y0) to (x1, y1): midpoint offsets across the line, pinned at both ends
 * and largest in the middle. Seeded, so the same event always draws the same bolt.
 * Returns `segments + 1` points as a flat [x, y, ...] array.
 */
export const buildLightningPath = (
    x0: number, y0: number, x1: number, y1: number,
    seed: number, segments: number, jag: number
): number[] => {
    const rng = createMulberry32(seed);
    const steps = Math.max(1, Math.floor(segments));
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    const points: number[] = [];
    for (let index = 0; index <= steps; index += 1) {
        const t = index / steps;
        const offset = index === 0 || index === steps ? 0 : (rng() * 2 - 1) * jag * length * Math.sin(Math.PI * t);
        points.push(x0 + dx * t + nx * offset, y0 + dy * t + ny * offset);
    }
    return points;
};

/** Cyan at a fresh combo, gold through the middle, rose-white at the top. */
export const comboArcTint = (intensity: number): string =>
    intensity < 0.35 ? '#8fdcff' : intensity < 0.6 ? '#ffd27a' : intensity < 0.8 ? '#ffb070' : '#ff9ad8';
