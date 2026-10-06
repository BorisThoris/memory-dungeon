import type { BoardState } from '../../shared/contracts';
import type { BoardParticleKind } from './boardParticleSystem';
import { getBreakWaveDelaySec } from './tileBoardBreakWave';

export interface BoardParticleCue { tileId: string; kind: BoardParticleKind; delay: number }

export const particleBoardChanged = (before: BoardState | null, board: BoardState): boolean => {
    if (!before || before.level !== board.level || before.columns !== board.columns ||
        before.tiles.length !== board.tiles.length || before.matchedPairs > board.matchedPairs) return true;
    // Flips and pauses keep card order. Avoid an all-pairs identity search on every committed turn.
    if (before.tiles === board.tiles || before.tiles.every((tile, index) => tile.id === board.tiles[index]!.id)) return false;
    // Currents can move cards without beginning a new board; identity, not cell, decides a reset.
    const currentIds = new Set(board.tiles.map(tile => tile.id));
    return before.tiles.some(tile => !currentIds.has(tile.id));
};

/** Compare committed card states: no replay on mount, preview, pause, shuffle, or context recovery. */
export const collectBoardParticleCues = (before: BoardState | null, board: BoardState): BoardParticleCue[] => {
    if (particleBoardChanged(before, board)) return [];
    const previous = new Map(before!.tiles.map((tile) => [tile.id, tile]));
    return board.tiles.flatMap((tile): BoardParticleCue[] => {
        const old = previous.get(tile.id);
        if (!old || old.state === tile.state || old.state === 'matched' || old.state === 'removed') return [];
        if (tile.state === 'removed') return [{ tileId: tile.id,
            kind: tile.brokenByChunk ? 'chain' : 'bomb', delay: tile.brokenByChunk ? getBreakWaveDelaySec(board, tile) : 0 }];
        if (tile.state === 'matched') return [{ tileId: tile.id, kind: 'match', delay: 0 }];
        return tile.state === 'flipped' ? [{ tileId: tile.id, kind: 'flip', delay: 0 }] : [];
    });
};
