import type { BoardState } from './contracts';
import { createMulberry32, hashStringToSeed, pickRngIndex } from './rng';
import { isSingletonUtilityPairKey } from './tile-identity';

/**
 * The anchor (floor 5, the Anchor Chain): the floor points at one card and asks for its partner.
 *
 * It used to name the pair just matched as the "anchor" every second match - a pair already off
 * the board - and tint it only while face up in play, which a matched pair never is again. So the
 * mutator on every fifth floor had no effect a player could see or use (found by the test hall).
 *
 * Now: once the floor has seen a match, it chooses a pair still fully face down as the anchor and
 * marks ONE of its two cards. The player knows where half of it is; the other half is the memory
 * question. Matching the anchor pays an extra link on the chain - which climbs the rungs sooner and
 * reaches the every-fifth-link miss sooner. Two matches without it and the anchor moves on to
 * another pair, so it is a standing offer, not a chore; if the pair leaves the board some other way
 * (a pop, a bomb, the magpie), a new one is chosen at the next match.
 */

/** Matches an anchor is left standing for before the floor points somewhere else. */
export const ANCHOR_PATIENCE_MATCHES = 2;
/** Extra chain links a matched anchor pays on top of the match's own. */
export const ANCHOR_BONUS_LINKS = 1;

const fullyHiddenPairKeys = (board: BoardState): string[] => {
    const halves = new Map<string, number>();
    for (const tile of board.tiles) {
        if (isSingletonUtilityPairKey(tile.pairKey)) continue;
        if (tile.state === 'hidden') halves.set(tile.pairKey, (halves.get(tile.pairKey) ?? 0) + 1);
    }
    return [...halves.entries()]
        .filter(([, count]) => count === 2)
        .map(([key]) => key)
        .sort();
};

/** The card the anchor marks: the first of its pair in board order that is still face down. */
export const anchorMarkedTileId = (board: BoardState | null | undefined, pairKey: string | null | undefined): string | null => {
    if (!board || !pairKey) return null;
    return board.tiles.find((tile) => tile.pairKey === pairKey && tile.state === 'hidden')?.id ?? null;
};

export interface AnchorAfterMatch {
    anchorPairKey: string | null;
    /** The pair just matched was the anchor: the chain takes `ANCHOR_BONUS_LINKS` more. */
    anchorMatched: boolean;
    /** Matches since the current anchor was set (reset when a new one is chosen). */
    matchesSinceAnchor: number;
}

/**
 * The anchor after a match, on the board the turn produced. `matchesSinceAnchorBefore` counts the
 * matches the current anchor has stood through.
 */
export const resolveAnchorAfterMatch = ({
    board,
    anchorPairKeyBefore,
    matchesSinceAnchorBefore,
    matchedPairKey,
    runSeed,
    rulesVersion,
    matchResolutions
}: {
    board: BoardState;
    anchorPairKeyBefore: string | null;
    matchesSinceAnchorBefore: number;
    matchedPairKey: string;
    runSeed: number;
    rulesVersion: number;
    matchResolutions: number;
}): AnchorAfterMatch => {
    const anchorMatched = anchorPairKeyBefore != null && anchorPairKeyBefore === matchedPairKey;
    const candidates = fullyHiddenPairKeys(board);
    const stillStanding = anchorPairKeyBefore != null && candidates.includes(anchorPairKeyBefore);
    const patience = matchesSinceAnchorBefore + 1;
    if (stillStanding && !anchorMatched && patience < ANCHOR_PATIENCE_MATCHES) {
        return { anchorPairKey: anchorPairKeyBefore, anchorMatched, matchesSinceAnchor: patience };
    }
    // A new anchor: never the one just claimed or walked away from, if there is any other choice.
    const pool = candidates.length > 1 ? candidates.filter((key) => key !== anchorPairKeyBefore) : candidates;
    if (pool.length === 0) return { anchorPairKey: null, anchorMatched, matchesSinceAnchor: 0 };
    const rng = createMulberry32(hashStringToSeed(`anchor:${runSeed}:${rulesVersion}:${board.level}:${matchResolutions}`));
    return { anchorPairKey: pool[pickRngIndex(rng, pool.length)]!, anchorMatched, matchesSinceAnchor: 0 };
};
