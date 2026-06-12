import { describe, expect, it } from 'vitest';

import { GAME_RULES_VERSION, type Tile } from './contracts';
import { buildBoard } from './board-build-rules';
import { EXIT_PAIR_KEY } from './tile-identity';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden'
});

describe('board build rules', () => {
    it('builds deterministic generated boards from seed and rules version', () => {
        const options = { runSeed: 19_001, runRulesVersion: GAME_RULES_VERSION };

        expect(buildBoard(4, options)).toEqual(buildBoard(4, options));
    });

    it('copies exact fixed tiles without dungeon augmentation', () => {
        const fixedTiles = [tile('a1', 'A'), tile('a2', 'A')];

        const board = buildBoard(2, {
            fixedTiles,
            fixedTilesMode: 'exact',
            gameMode: 'endless',
            runSeed: 19_002,
            runRulesVersion: GAME_RULES_VERSION
        });

        expect(board.tiles).toEqual(fixedTiles);
        expect(board.tiles).not.toBe(fixedTiles);
        expect(board.dungeonExitTileId).toBeNull();
        expect(board.dungeonObjectiveId).toBe('find_exit');
    });

    it('adds dungeon and spotlight metadata when requested', () => {
        const board = buildBoard(3, {
            activeMutators: ['shifting_spotlight'],
            gameMode: 'endless',
            runSeed: 19_003,
            runRulesVersion: GAME_RULES_VERSION
        });

        expect(board.tiles.some((candidate) => candidate.pairKey === EXIT_PAIR_KEY)).toBe(true);
        expect(new Set([board.wardPairKey, board.bountyPairKey]).size).toBe(2);
    });
});
