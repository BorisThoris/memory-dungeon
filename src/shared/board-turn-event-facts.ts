import type { TileTraitKind, RunState } from './contracts';
import { getSafeBoardColumns } from './board-grid-dimensions';
import { runChainTier } from './chain-tier-rules';
import { TILE_TRAIT_COUNT_KINDS } from './session-stats-rules';
import { getMatchFloaterAnchorTileIds, getMismatchFloaterAnchorTileIds } from './turn-resolution';
import { runNonNegativeInteger } from './run-number-guards';
import { normalizeSessionStats } from './session-stats-rules';

/**
 * Presentation facts the core resolves once, at the moment a turn resolves, and stamps
 * onto the board.turn_resolved event.
 *
 * The renderer used to re-derive these by diffing board snapshots, which meant the
 * feedback layer was guessing at what the rules had decided. Anything the floaters,
 * toasts or live-region announcements need in order to describe a turn belongs here, so
 * the projector can stay a pure function of the event.
 */
export interface BoardTurnAnnouncementFacts {
    /** Chunk breaks this floor and the pairs they took, before and after this turn. */
    chunkBreaksBefore: number;
    chunkBreaksAfter: number;
    chunkPairsBrokenBefore: number;
    chunkPairsBrokenAfter: number;
    /** The chain the run holds after this turn; zero after a mismatch. */
    chainAfter: number;
    /** The break tier that chain reaches on this floor, stamped by the rules so no surface recomputes it. */
    chainTierAfter: 'none' | 'clean' | 'sharp' | 'fever';
    /** The tier the run held before this turn, so a miss can say what it ended. */
    chainTierBefore: 'none' | 'clean' | 'sharp' | 'fever';
    /**
     * The shape of this turn's chunk, for the style line (Peggle's "Long shot"): the widest gap
     * between a broken pair's halves in grid steps, pairs the halo took from another suit, and
     * whether the match's suit is now gone from the floor. Zeros on a turn without a break.
     */
    chunkPartnerSpanMax: number;
    chunkHaloPairs: number;
    chunkSuitCleared: boolean;
    /** Pairs that dropped with this turn's break because their suit had too few left to hold them. */
    chunkDroppedPairs: number;
    /** Waves the ripple ran this turn: 1 for a pop that stopped at its own clump, 0 without a break. */
    chunkRippleWaves: number;
    /** Pairs the magpie took back this floor, before and after this turn. */
    magpieTheftsBefore: number;
    magpieTheftsAfter: number;
    /** Times a guard token drove it off this floor, before and after this turn. */
    magpieScaredOffBefore: number;
    magpieScaredOffAfter: number;
    /**
     * Which tiles the floater anchors to. Not simply the flipped ids: a gambit resolves
     * three tiles but the floater belongs on the matched pair, and only the rules layer
     * knows which two those were.
     */
    anchorTileIds: string[];
    level: number;
    currentStreakBefore: number;
    currentStreakAfter: number;
    comboShardsBefore: number;
    comboShardsAfter: number;
    guardTokensBefore: number;
    guardTokensAfter: number;
    livesBefore: number;
    livesAfter: number;
    findablesClaimedBefore: number;
    findablesClaimedAfter: number;
    findablesTotalBefore: number;
    findablesTotalAfter: number;
    /** Trait kinds actually involved in this turn, resolved here so the renderer never diffs trait counts. */
    matchedTraitKinds: TileTraitKind[];
    shuffleChargesBefore: number;
    shuffleChargesAfter: number;
    regionShuffleChargesBefore: number;
    regionShuffleChargesAfter: number;
    stickyBlockIndexBefore: number | null;
    stickyBlockIndexAfter: number | null;
    matchedPairsBefore: number;
    matchedPairsAfter: number;
    pairTotal: number;
    mismatchesBefore: number;
    mismatchesAfter: number;
}

const firstTileValue = <T>(
    run: RunState,
    tileIds: readonly string[],
    read: (tile: NonNullable<RunState['board']>['tiles'][number]) => T | null | undefined
): T | null => {
    for (const tileId of tileIds) {
        const tile = run.board?.tiles.find((candidate) => candidate.id === tileId);
        const value = tile ? read(tile) : null;
        if (value !== null && value !== undefined) {
            return value;
        }
    }
    return null;
};

/**
 * What this turn's chunk looked like, read off the two boards: a tile that was hidden before and
 * is `removed` (by a chunk) after is a tile the chunk took. Nothing here re-runs the break rule;
 * it describes the board the rule left, which is the only thing the announcer may read.
 */
const chunkStyleFacts = (
    before: RunState,
    after: RunState,
    matchedTileIds: readonly string[]
): Pick<
    BoardTurnAnnouncementFacts,
    'chunkPartnerSpanMax' | 'chunkHaloPairs' | 'chunkSuitCleared' | 'chunkRippleWaves'
> => {
    const none = { chunkPartnerSpanMax: 0, chunkHaloPairs: 0, chunkSuitCleared: false, chunkRippleWaves: 0 };
    const afterBoard = after.board;
    if (!afterBoard) {
        return none;
    }
    const columns = getSafeBoardColumns(afterBoard);
    const beforeState = new Map((before.board?.tiles ?? []).map((tile) => [tile.id, tile.state]));
    const taken = afterBoard.tiles
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile }) => tile.state === 'removed' && tile.brokenByChunk === true && beforeState.get(tile.id) === 'hidden');
    if (taken.length === 0) {
        return none;
    }
    const byPair = new Map<string, number[]>();
    for (const { tile, index } of taken) {
        byPair.set(tile.pairKey, [...(byPair.get(tile.pairKey) ?? []), index]);
    }
    const matchSuit = firstTileValue(before, matchedTileIds, (tile) => tile.suit ?? null);
    let spanMax = 0;
    let haloPairs = 0;
    for (const indexes of byPair.values()) {
        if (indexes.length === 2) {
            const [a, b] = indexes as [number, number];
            spanMax = Math.max(
                spanMax,
                Math.abs(Math.floor(a / columns) - Math.floor(b / columns)) + Math.abs((a % columns) - (b % columns))
            );
        }
        const first = afterBoard.tiles[indexes[0]!]!;
        if (matchSuit && first.suit && first.suit !== matchSuit) {
            haloPairs += 1;
        }
    }
    const suitCleared =
        matchSuit != null && !afterBoard.tiles.some((tile) => tile.state === 'hidden' && tile.suit === matchSuit);
    // The rule stamps each taken tile with its wave; the ripple's length is the last wave plus one.
    const rippleWaves = taken.reduce((max, { tile }) => Math.max(max, runNonNegativeInteger(tile.brokenAtWave ?? 0)), 0) + 1;
    return {
        chunkPartnerSpanMax: spanMax,
        chunkHaloPairs: haloPairs,
        chunkSuitCleared: suitCleared,
        chunkRippleWaves: rippleWaves
    };
};

export const getBoardTurnAnnouncementFacts = (
    before: RunState,
    after: RunState
): BoardTurnAnnouncementFacts => {
    const statsBefore = normalizeSessionStats(before.stats);
    const statsAfter = normalizeSessionStats(after.stats);
    const flippedTileIds = Array.isArray(before.board?.flippedTileIds) ? before.board.flippedTileIds : [];
    // Derived here rather than passed in, so callers cannot describe a turn as a match
    // when the stats say otherwise.
    const outcome: 'match' | 'mismatch' =
        statsAfter.matchesFound > statsBefore.matchesFound ? 'match' : 'mismatch';
    // Selected by outcome, not by falling through: a gambit match resolves three tiles
    // and only the match anchor knows which two actually paired. Falling back to the
    // mismatch anchor would put the floater on the odd tile out.
    const anchor =
        outcome === 'match'
            ? getMatchFloaterAnchorTileIds(before)
            : getMismatchFloaterAnchorTileIds(before);
    return {
        anchorTileIds: anchor
            ? [
                  anchor.tileIdA,
                  anchor.tileIdB,
                  ...('tileIdC' in anchor && typeof anchor.tileIdC === 'string' ? [anchor.tileIdC] : [])
              ]
            : [...flippedTileIds],
        level: runNonNegativeInteger(before.board?.level),
        currentStreakBefore: statsBefore.currentStreak,
        currentStreakAfter: statsAfter.currentStreak,
        comboShardsBefore: statsBefore.comboShards,
        comboShardsAfter: statsAfter.comboShards,
        guardTokensBefore: runNonNegativeInteger(statsBefore.guardTokens),
        guardTokensAfter: runNonNegativeInteger(statsAfter.guardTokens),
        livesBefore: runNonNegativeInteger(before.lives),
        livesAfter: runNonNegativeInteger(after.lives),
        findablesClaimedBefore: runNonNegativeInteger(before.findablesClaimedThisFloor),
        findablesClaimedAfter: runNonNegativeInteger(after.findablesClaimedThisFloor),
        findablesTotalBefore: runNonNegativeInteger(before.findablesTotalThisFloor),
        findablesTotalAfter: runNonNegativeInteger(after.findablesTotalThisFloor),
        chunkBreaksBefore: runNonNegativeInteger(before.chunkBreaksThisFloor),
        chunkBreaksAfter: runNonNegativeInteger(after.chunkBreaksThisFloor),
        chunkPairsBrokenBefore: runNonNegativeInteger(before.chunkPairsBrokenThisFloor),
        chunkPairsBrokenAfter: runNonNegativeInteger(after.chunkPairsBrokenThisFloor),
        chainAfter: runNonNegativeInteger(after.stats.currentStreak),
        chainTierAfter: runChainTier(after),
        chainTierBefore: runChainTier(before),
        ...chunkStyleFacts(before, after, flippedTileIds),
        chunkDroppedPairs: Math.max(
            0,
            runNonNegativeInteger(after.chunkPairsDroppedThisFloor) - runNonNegativeInteger(before.chunkPairsDroppedThisFloor)
        ),
        magpieTheftsBefore: runNonNegativeInteger(before.magpieTheftsThisFloor),
        magpieTheftsAfter: runNonNegativeInteger(after.magpieTheftsThisFloor),
        magpieScaredOffBefore: runNonNegativeInteger(before.magpieScaredOffThisFloor),
        magpieScaredOffAfter: runNonNegativeInteger(after.magpieScaredOffThisFloor),
        matchedTraitKinds: TILE_TRAIT_COUNT_KINDS.filter((kind) =>
            flippedTileIds.some(
                (tileId) => before.board?.tiles.find((tile) => tile.id === tileId)?.tileTraitKind === kind
            )
        ),
        shuffleChargesBefore: runNonNegativeInteger(before.shuffleCharges),
        shuffleChargesAfter: runNonNegativeInteger(after.shuffleCharges),
        regionShuffleChargesBefore: runNonNegativeInteger(before.regionShuffleCharges),
        regionShuffleChargesAfter: runNonNegativeInteger(after.regionShuffleCharges),
        stickyBlockIndexBefore: before.stickyBlockIndex ?? null,
        stickyBlockIndexAfter: after.stickyBlockIndex ?? null,
        matchedPairsBefore: runNonNegativeInteger(before.board?.matchedPairs),
        matchedPairsAfter: runNonNegativeInteger(after.board?.matchedPairs),
        pairTotal: runNonNegativeInteger(after.board?.pairCount ?? before.board?.pairCount),
        mismatchesBefore: statsBefore.mismatches,
        mismatchesAfter: statsAfter.mismatches
    };
};
