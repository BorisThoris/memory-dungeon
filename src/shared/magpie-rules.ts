import type { BoardState, Tile } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';

/**
 * The magpie: the one thing in this dungeon that takes back work you have already done.
 *
 * Every other hazard here costs a life, a charge or a few points — things the HUD can restore and
 * the player can stop thinking about. Nothing touched the only resource a memory game actually
 * runs on, which is what the player has in their head. So the magpie waits until a miss, picks a
 * pair already cleared, hides it again, and puts it back somewhere it was never seen. The score is
 * untouched. What is gone is the knowing.
 *
 * It is deliberately not every miss. A thief that empties the board every time you slip is not a
 * joke, it is a tax; this one gets bold on every third miss, which is often enough to be a
 * character and rare enough to be a story. And it can be driven off: a guard token scares it, which
 * gives that resource something to do beyond absorbing damage, and gives the player a real
 * decision to make with it while the bird is on the floor.
 */

/** Misses between visits. It arrives on the third, not the first: the first one is a warning. */
export const MAGPIE_MISS_INTERVAL = 3;

export interface MagpieTheft {
    /** The cleared pair it takes back. */
    readonly pairKey: string;
    /** Tiles that are hidden again, in the positions they moved to. */
    readonly tileIds: readonly string[];
    /** Cells the stolen pair now sits in, so the board can say where it went — or refuse to. */
    readonly toIndices: readonly number[];
}

export interface MagpieVisit {
    readonly kind: 'theft' | 'scared_off' | 'nothing_to_take' | 'not_yet';
    readonly theft: MagpieTheft | null;
    /** Guard tokens left after the visit; a scared-off magpie costs one. */
    readonly guardTokens: number;
}

/** True on the misses the magpie shows up for. */
export const isMagpieVisitTurn = (mismatchCount: number): boolean =>
    Number.isFinite(mismatchCount) && mismatchCount > 0 && mismatchCount % MAGPIE_MISS_INTERVAL === 0;

/**
 * What it can take: pairs a chunk broke first, then pairs the player matched. It takes what you
 * were given before what you earned — funnier, and fairer. A defeated enemy is also `removed`,
 * so the chunk marks its casualties and the bird only picks up those.
 */
const chunkBrokenPairKeys = (board: BoardState): string[] => [
    ...new Set(
        board.tiles.filter((tile) => tile.state === 'removed' && tile.brokenByChunk === true).map((tile) => tile.pairKey)
    )
];

const matchedPairKeys = (board: BoardState): string[] => {
    const cascaded = chunkBrokenPairKeys(board);
    return cascaded.length > 0
        ? cascaded
        : [...new Set(board.tiles.filter((tile) => tile.state === 'matched').map((tile) => tile.pairKey))];
};

/**
 * Where a stolen pair can land: cells holding tiles that are still face down.
 *
 * Deliberately not empty space or matched cells. The pair has to come back somewhere the player
 * will genuinely have to look, and swapping with hidden tiles keeps the board's shape intact — the
 * theft moves knowledge around rather than changing what is on the floor.
 */
const hiddenIndices = (board: BoardState, exceptPairKey: string): number[] =>
    board.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ tile }) => tile.state === 'hidden' && tile.pairKey !== exceptPairKey)
        .map(({ index }) => index);

/**
 * What the magpie does on this miss, decided from the run's own seed so a replay sees the same bird.
 */
export const resolveMagpieVisit = ({
    board,
    guardTokens,
    mismatchCount,
    runSeed,
    rulesVersion
}: {
    board: BoardState;
    guardTokens: number;
    mismatchCount: number;
    runSeed: number;
    rulesVersion: number;
}): MagpieVisit => {
    const tokens = Number.isFinite(guardTokens) ? Math.max(0, Math.trunc(guardTokens)) : 0;
    if (!isMagpieVisitTurn(mismatchCount)) {
        return { guardTokens: tokens, kind: 'not_yet', theft: null };
    }

    const candidates = matchedPairKeys(board);
    if (candidates.length === 0) {
        // Nothing cleared yet, so nothing to take. It still turns up, which is the joke.
        return { guardTokens: tokens, kind: 'nothing_to_take', theft: null };
    }

    /*
     * A guard token is spent to drive it off before the pick is made, so holding one is genuinely
     * protection rather than a refund after the fact.
     */
    if (tokens > 0) {
        return { guardTokens: tokens - 1, kind: 'scared_off', theft: null };
    }

    const rng = createMulberry32(hashStringToSeed(`magpie:${runSeed}:${rulesVersion}:${board.level}:${mismatchCount}`));
    const pairKey = candidates[pickRngIndex(rng, candidates.length)] ?? candidates[0] ?? '';
    const stolenIndices = board.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ tile }) => tile.pairKey === pairKey)
        .map(({ index }) => index);
    const landing = hiddenIndices(board, pairKey);

    /*
     * With too few face-down tiles left to swap into, the pair comes back where it was. The bird
     * still took it — the player still has to find it again — but the board is not rearranged into
     * something the generator never produced.
     */
    const toIndices =
        landing.length >= stolenIndices.length
            ? stolenIndices.map(() => {
                  const choice = landing[pickRngIndex(rng, landing.length)] ?? landing[0] ?? 0;
                  landing.splice(landing.indexOf(choice), 1);
                  return choice;
              })
            : stolenIndices;

    return {
        guardTokens: tokens,
        kind: 'theft',
        theft: {
            pairKey,
            tileIds: stolenIndices.map((index) => board.tiles[index]?.id ?? ''),
            toIndices
        }
    };
};

/**
 * Applies the theft: the pair goes face down again, in its new cells, and whatever was in those
 * cells takes its old place. Everything else about the board is untouched.
 */
export const applyMagpieTheft = (board: BoardState, theft: MagpieTheft): BoardState => {
    const tiles: Tile[] = [...board.tiles];
    const fromIndices = board.tiles
        .map((tile, index) => ({ index, tile }))
        .filter(({ tile }) => tile.pairKey === theft.pairKey)
        .map(({ index }) => index);

    fromIndices.forEach((from, slot) => {
        const to = theft.toIndices[slot] ?? from;
        const stolen = board.tiles[from];
        const displaced = board.tiles[to];
        if (!stolen || !displaced) {
            return;
        }
        // Back on the floor, so no longer a chunk casualty — the bird cannot take it twice for free.
        tiles[to] = { ...stolen, state: 'hidden', brokenByChunk: undefined };
        if (to !== from) {
            tiles[from] = displaced;
        }
    });

    return {
        ...board,
        tiles,
        // The pair is on the floor again, so the board is one pair further from cleared.
        matchedPairs: Math.max(0, board.matchedPairs - 1)
    };
};
