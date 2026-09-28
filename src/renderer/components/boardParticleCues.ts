import type { BoardState } from '../../shared/contracts';
import type { BoardParticleKind } from './boardParticleSystem';
import { getBreakWaveDelaySec } from './tileBoardBreakWave';

export interface BoardParticleCue { tileId: string; kind: BoardParticleKind; delay: number }

export const particleBoardChanged = (before: BoardState | null, board: BoardState): boolean =>
    !before || before.level !== board.level || before.columns !== board.columns ||
    before.tiles.length !== board.tiles.length || before.matchedPairs > board.matchedPairs ||
    before.tiles.some((tile) => !board.tiles.some((next) => next.id === tile.id));

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
