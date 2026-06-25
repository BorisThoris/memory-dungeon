import { describe, expect, it } from 'vitest';
import { EXIT_PAIR_KEY } from '../tile-identity';
import { makeBoard, makeRun, makeTile, revealAndActivateExit } from './game-fixtures';

describe('game fixture helpers', () => {
    it('reveals and activates the declared primary exit before earlier bonus exits', () => {
        const bonusExit = {
            ...makeTile('bonus-exit', EXIT_PAIR_KEY, 'B', {
                dungeonCardKind: 'exit',
                dungeonCardState: 'hidden',
                dungeonExitLockKind: 'none',
                state: 'hidden'
            })
        };
        const primaryExit = {
            ...makeTile('primary-exit', EXIT_PAIR_KEY, 'P', {
                dungeonCardKind: 'exit',
                dungeonCardState: 'hidden',
                dungeonExitLockKind: 'iron'
            })
        };
        const matchedA = makeTile('a1', 'a', 'A', { state: 'matched' });
        const matchedB = makeTile('a2', 'a', 'A', { state: 'matched' });
        const board = makeBoard([bonusExit, primaryExit, matchedA, matchedB], {
            dungeonExitTileId: 'primary-exit',
            dungeonExitLockKind: 'iron',
            matchedPairs: 1,
            pairCount: 1
        });
        const run = makeRun(board.tiles, {
            board,
            dungeonKeys: { iron: 1 },
            dungeonMasterKeys: 0,
            status: 'playing'
        });

        const cleared = revealAndActivateExit(run);

        expect(cleared.status).toBe('levelComplete');
        expect(cleared.dungeonKeys.iron).toBe(0);
        expect(cleared.board?.dungeonExitActivated).toBe(true);
    });
});
