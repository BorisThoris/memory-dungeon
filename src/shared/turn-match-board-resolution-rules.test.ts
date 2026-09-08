import { describe, expect, it } from 'vitest';
import type { BoardState, Tile } from './contracts';
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
            tiles: run.board!.tiles.map((tile) => {
                // Only the matched pair wears its suit, so its pop reaches nothing: what this test
                // is about is the gambit tile going back to hidden, not what a break takes.
                const suited =
                    tile.pairKey === first.pairKey ? { ...tile, suit: 'ember' as const } : { ...tile, suit: 'bone' as const };
                return tile.id === first.id || tile.id === second.id || tile.id === third.id
                    ? { ...suited, state: 'flipped' as const }
                    : suited;
            })
        };

        const result = resolveTurnMatchBoardResolution({
            run: { ...run, board },
            board,
            firstTileId: first.id,
            secondTileId: second.id,
            thirdTileId: third.id
        });

        expect(result.board.matchedPairs).toBe(board.matchedPairs + 1);
        expect(result.board.flippedTileIds).toEqual([]);
        expect(result.board.tiles.find((tile) => tile.id === first.id)?.state).toBe('matched');
        expect(result.board.tiles.find((tile) => tile.id === second.id)?.state).toBe('matched');
        expect(result.board.tiles.find((tile) => tile.id === third.id)?.state).toBe('hidden');
        expect(result.chunkBreak.brokenPairKeys).toEqual([]);
    });

    it('runs the chunk break on the claimed board', () => {
        const run = createNewRun(0);
        const [first, second] = firstPair(run.board!);
        // Every tile wears the matched suit, so the pop can reach whatever touches the pair.
        const board = {
            ...run.board!,
            flippedTileIds: [first.id, second.id],
            tiles: run.board!.tiles.map((tile) =>
                tile.id === first.id || tile.id === second.id
                    ? { ...tile, suit: 'ember' as const, state: 'flipped' as const }
                    : { ...tile, suit: 'ember' as const }
            )
        };

        const result = resolveTurnMatchBoardResolution({
            run: { ...run, board, floorCurioId: null },
            board,
            firstTileId: first.id,
            secondTileId: second.id
        });

        expect(result.chunkBreak.brokenPairKeys).not.toContain(first.pairKey);
        expect(result.board.matchedPairs).toBe(board.matchedPairs + 1 + result.chunkBreak.brokenPairKeys.length);
        for (const id of result.chunkBreak.brokenTileIds) {
            expect(result.board.tiles.find((tile) => tile.id === id)?.state).toBe('removed');
        }
    });
});
