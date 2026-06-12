import { describe, expect, it } from 'vitest';
import { FUSE_CACHE_FRESH_RESOLUTION_LIMIT, type BoardState, type Tile } from './contracts';
import { deriveMatchClaimContext } from './match-claim-rules';
import { createNewRun } from './run-creation-rules';
import { resolveTurnMatchBoardResolution } from './turn-match-board-resolution-rules';

const firstPair = (board: BoardState): [Tile, Tile] => {
    for (const tile of board.tiles) {
        const pair = board.tiles.find((candidate) => candidate.id !== tile.id && candidate.pairKey === tile.pairKey);
        if (pair) {
            return [tile, pair];
        }
    }
    throw new Error('Expected generated board to contain at least one pair');
};

describe('resolveTurnMatchBoardResolution', () => {
    it('claims the matched pair and hides the gambit third tile', () => {
        const run = createNewRun(0);
        const [first, second] = firstPair(run.board!);
        const third = run.board!.tiles.find((tile) => tile.pairKey !== first.pairKey)!;
        const board = {
            ...run.board!,
            flippedTileIds: [first.id, second.id, third.id],
            tiles: run.board!.tiles.map((tile) =>
                tile.id === first.id || tile.id === second.id || tile.id === third.id
                    ? { ...tile, state: 'flipped' as const }
                    : tile
            )
        };
        const context = deriveMatchClaimContext({
            firstTile: first,
            firstTileId: first.id,
            run: { ...run, board },
            secondTile: second,
            secondTileId: second.id
        });

        const result = resolveTurnMatchBoardResolution({
            run: { ...run, board },
            board,
            context,
            firstTile: first,
            secondTile: second,
            firstTileId: first.id,
            secondTileId: second.id,
            thirdTileId: third.id
        });

        expect(result.board.matchedPairs).toBe(board.matchedPairs + 1);
        expect(result.board.flippedTileIds).toEqual([]);
        expect(result.board.tiles.find((tile) => tile.id === first.id)?.state).toBe('matched');
        expect(result.board.tiles.find((tile) => tile.id === second.id)?.state).toBe('matched');
        expect(result.board.tiles.find((tile) => tile.id === third.id)?.state).toBe('hidden');
    });

    it('reports fresh fuse cache claims before the freshness limit', () => {
        const run = createNewRun(0);
        const [first, second] = firstPair(run.board!);
        const board = {
            ...run.board!,
            tiles: run.board!.tiles.map((tile) =>
                tile.id === first.id || tile.id === second.id ? { ...tile, tileHazardKind: 'fuse_cache' as const } : tile
            )
        };
        const context = deriveMatchClaimContext({
            firstTile: board.tiles.find((tile) => tile.id === first.id)!,
            firstTileId: first.id,
            run: { ...run, board, matchResolutionsThisFloor: 0 },
            secondTile: board.tiles.find((tile) => tile.id === second.id)!,
            secondTileId: second.id
        });

        const result = resolveTurnMatchBoardResolution({
            run: { ...run, board, matchResolutionsThisFloor: 0 },
            board,
            context,
            firstTile: board.tiles.find((tile) => tile.id === first.id)!,
            secondTile: board.tiles.find((tile) => tile.id === second.id)!,
            firstTileId: first.id,
            secondTileId: second.id
        });

        expect(result.fuseCacheClaimed).toBe(true);
        expect(result.fuseCacheFresh).toBe(true);
    });

    it('reports expired fuse cache claims at the freshness limit', () => {
        const run = createNewRun(0);
        const [first, second] = firstPair(run.board!);
        const board = {
            ...run.board!,
            tiles: run.board!.tiles.map((tile) =>
                tile.id === first.id || tile.id === second.id ? { ...tile, tileHazardKind: 'fuse_cache' as const } : tile
            )
        };
        const activeRun = { ...run, board, matchResolutionsThisFloor: FUSE_CACHE_FRESH_RESOLUTION_LIMIT };
        const firstTile = board.tiles.find((tile) => tile.id === first.id)!;
        const secondTile = board.tiles.find((tile) => tile.id === second.id)!;
        const context = deriveMatchClaimContext({
            firstTile,
            firstTileId: first.id,
            run: activeRun,
            secondTile,
            secondTileId: second.id
        });

        const result = resolveTurnMatchBoardResolution({
            run: activeRun,
            board,
            context,
            firstTile,
            secondTile,
            firstTileId: first.id,
            secondTileId: second.id
        });

        expect(result.fuseCacheClaimed).toBe(true);
        expect(result.fuseCacheFresh).toBe(false);
    });
});
