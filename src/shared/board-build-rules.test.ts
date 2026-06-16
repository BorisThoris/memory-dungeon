import { describe, expect, it } from 'vitest';

import { GAME_RULES_VERSION, type DungeonExitLockKind, type Tile } from './contracts';
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

    it('does not generate unsolvable primary dungeon exits across seeded floors', () => {
        const seeds = [19_101, 19_202, 19_303, 19_404, 19_505];
        const floors = Array.from({ length: 18 }, (_, index) => index + 1);

        for (const runSeed of seeds) {
            for (const level of floors) {
                const board = buildBoard(level, {
                    gameMode: 'endless',
                    runSeed,
                    runRulesVersion: GAME_RULES_VERSION
                });
                const primaryExit = board.tiles.find((candidate) => candidate.id === board.dungeonExitTileId);
                expect(primaryExit, `seed ${runSeed} level ${level} primary exit`).toBeTruthy();

                const lockKind = (primaryExit?.dungeonExitLockKind ?? 'none') as DungeonExitLockKind;
                if (lockKind === 'lever') {
                    const leverPairs = new Set(
                        board.tiles
                            .filter((candidate) => candidate.dungeonCardKind === 'lever' && candidate.dungeonCardEffectId === 'lever_floor')
                            .map((candidate) => candidate.pairKey)
                    );
                    expect(
                        leverPairs.size,
                        `seed ${runSeed} level ${level} lever exit needs ${primaryExit?.dungeonExitRequiredLeverCount ?? 0}`
                    ).toBeGreaterThanOrEqual(primaryExit?.dungeonExitRequiredLeverCount ?? 0);
                } else if (lockKind !== 'none') {
                    const hasMatchingKeyPair = board.tiles.some(
                        (candidate) => candidate.dungeonCardKind === 'key' && candidate.dungeonKeyKind === lockKind
                    );
                    const hasKeyRoom = board.tiles.some((candidate) => candidate.dungeonCardEffectId === 'room_key_cache');
                    const hasShop = board.dungeonShopTileId != null;
                    expect(
                        hasMatchingKeyPair || hasKeyRoom || hasShop,
                        `seed ${runSeed} level ${level} ${lockKind} exit has no key source`
                    ).toBe(true);
                }
            }
        }
    });
});
