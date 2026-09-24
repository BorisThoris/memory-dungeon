import type { BoardState } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { orthogonalNeighbourIndices } from './skittish-cards-rules';

/**
 * Lantern light: every match lights the cards beside it.
 *
 * When a pair is matched, up to `LANTERN_MAX_LIT` of the face-down cards touching either matched
 * card (up, down, left or right) show their faces - until the next card is turned. It is the
 * reward-shaped dynamic, where the skittish hall and the restless floor take: the clock is the
 * player's own matches, and it turns the order of play into a choice. A pair matched at the edge
 * of the board lights little; one matched in the unread middle lights the most. So the question on
 * this floor is not only "what do I know" but "where would knowing more help".
 *
 * It is not a peek: nothing is spent, and the reveal lives in its own field so a floor objective or
 * an achievement that forbids peeking is not tripped by a light the player never asked for. It
 * lights only cards still face down, and what it lights goes dark on the next flip, the same way a
 * flashed pair does.
 */

/** A lantern shows at most this many faces per match: enough to steer by, not enough to read the board. */
export const LANTERN_MAX_LIT = 3;

/**
 * The cards a match lights, decided from the run's seed and the floor's turn count so a replay
 * lights the same ones. `matchedTileIds` are the pair just matched, on the board the turn produced.
 */
export const resolveLanternLight = ({
    board,
    matchedTileIds,
    turnsThisFloor,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    matchedTileIds: readonly string[];
    turnsThisFloor: number;
    runSeed: number;
    rulesVersion: number;
}): string[] => {
    const touching = new Set<number>();
    for (const id of matchedTileIds) {
        const index = board.tiles.findIndex((tile) => tile.id === id);
        if (index < 0) continue;
        for (const neighbour of orthogonalNeighbourIndices(index, board.columns, board.tiles.length)) {
            if (board.tiles[neighbour]?.state === 'hidden') touching.add(neighbour);
        }
    }
    const pool = [...touching].sort((a, b) => a - b);
    if (pool.length <= LANTERN_MAX_LIT) return pool.map((index) => board.tiles[index]!.id);
    const rng = createMulberry32(hashStringToSeed(`lantern:${runSeed}:${rulesVersion}:${board.level}:${turnsThisFloor}`));
    const lit: string[] = [];
    while (lit.length < LANTERN_MAX_LIT && pool.length > 0) {
        const [index] = pool.splice(pickRngIndex(rng, pool.length), 1);
        lit.push(board.tiles[index!]!.id);
    }
    return lit;
};
