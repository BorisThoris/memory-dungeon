import { describe, expect, it } from 'vitest';
import { createNewRun, finishMemorizePhase, flipTile } from './game';
import { releaseRejectedBoardTurn } from './gameplay-core-adapters';

describe('releaseRejectedBoardTurn', () => {
    it('turns a stuck turn back down and returns the board to play', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 99 }));
        const tiles = run.board!.tiles.filter((tile) => tile.state === 'hidden');
        const second = tiles.find((tile) => tile.pairKey !== tiles[0]!.pairKey)!;
        const resolving = flipTile(flipTile(run, tiles[0]!.id), second.id);
        expect(resolving.status).toBe('resolving');

        const released = releaseRejectedBoardTurn(resolving);
        expect(released.status).toBe('playing');
        expect(released.board!.flippedTileIds).toEqual([]);
        expect(released.board!.tiles.every((tile) => tile.state !== 'flipped')).toBe(true);
    });

    it('leaves a run that is not resolving alone', () => {
        const run = finishMemorizePhase(createNewRun(0, { echoFeedbackEnabled: false, gameMode: 'endless', runSeed: 99 }));
        expect(releaseRejectedBoardTurn(run)).toBe(run);
    });
});
