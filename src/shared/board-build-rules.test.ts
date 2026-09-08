import { describe, expect, it } from 'vitest';

import { GAME_RULES_VERSION, type FloorArchetypeId, type Tile } from './contracts';
import { buildBoard } from './board-build-rules';

const tile = (id: string, pairKey: string): Tile => ({
    id,
    pairKey,
    symbol: pairKey,
    label: pairKey,
    state: 'hidden'
});

describe('board build rules', () => {
    /*
     * The floor is pairs and nothing else.
     *
     * Thirty-three tests used to live across this suite and `game.test.ts` asserting the opposite,
     * one dungeon family at a time: an exit is placed, a shop spawns on some floors, a room spawns
     * on others, traps spring on reveal, hazards rotate on a telegraph, key locks stay optional.
     * Each was a true statement about generation and each was a stop - a tile the player had to
     * resolve before the floor would let them go. They are replaced by this one, which says the
     * thing they collectively made impossible.
     *
     * It is written as a sweep rather than a spot check because that is the failure mode: a single
     * archetype, mutator or route plan quietly reintroducing one card is exactly what nobody
     * notices. `docs/REMOVED_DUNGEON_LAYER.md` records what each family did.
     */
    it('deals generated floors as pairs and nothing else, across every floor shape', () => {
        const seeds = [19_101, 42_001, 172_707, 867_5309] as const;
        const archetypes: Array<FloorArchetypeId | null> = [null, 'trap_hall', 'rush_recall', 'treasure_gallery'];

        for (const runSeed of seeds) {
            for (let level = 1; level <= 16; level += 1) {
                for (const floorArchetypeId of archetypes) {
                    for (const floorTag of ['normal', 'boss', 'breather'] as const) {
                        const where = `seed ${runSeed} level ${level} ${floorArchetypeId ?? 'none'} ${floorTag}`;
                        const board = buildBoard(level, {
                            runSeed,
                            runRulesVersion: GAME_RULES_VERSION,
                            gameMode: 'endless',
                            floorTag,
                            floorArchetypeId,
                            activeMutators: []
                        });

                        const counts = new Map<string, number>();
                        for (const boardTile of board.tiles) {
                            counts.set(boardTile.pairKey, (counts.get(boardTile.pairKey) ?? 0) + 1);
                        }
                        expect([...counts.entries()].filter(([, count]) => count !== 2), where).toEqual([]);
                        expect(counts.size, where).toBe(board.pairCount);

                        expect(board.tiles.filter((boardTile) => boardTile.dungeonCardKind != null), where).toEqual([]);
                        expect(board.tiles.filter((boardTile) => boardTile.tileHazardKind != null), where).toEqual([]);
                        expect(board.tiles.filter((boardTile) => boardTile.routeCardKind != null), where).toEqual([]);
                        expect(board.enemyHazards ?? [], where).toEqual([]);
                        expect(board.dungeonExitTileId, where).toBeNull();
                        expect(board.dungeonShopTileId, where).toBeNull();
                        expect(board.dungeonBossId, where).toBeNull();
                    }
                }
            }
        }
    });

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


});
