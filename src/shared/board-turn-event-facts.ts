import type { RouteCardKind, RouteSpecialKind, TileTraitKind, RunState } from './contracts';
import { runChainTier } from './chain-tier-rules';
import { TILE_TRAIT_COUNT_KINDS } from './session-stats-rules';
import {
    getGameplayFeedbackObjectiveSnapshot,
    type GameplayFeedbackObjectiveSnapshot
} from './gameplay-feedback-facts';
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
/**
 * Per-kind hazard-tile firings for this turn.
 *
 * The announcer needs the exact kind - and, for fragile and fuse caches, whether the
 * cache broke - to pick its copy. A single aggregate count can only ever name one
 * hazard, so a turn that fires two says the wrong thing about one of them.
 */
export interface BoardTurnHazardKindFacts {
    shuffleSnareBefore: number;
    shuffleSnareAfter: number;
    cascadeCacheBefore: number;
    cascadeCacheAfter: number;
    mirrorDecoyBefore: number;
    mirrorDecoyAfter: number;
    fragileCacheClaimBefore: number;
    fragileCacheClaimAfter: number;
    fragileCacheBreakBefore: number;
    fragileCacheBreakAfter: number;
    tollCacheBefore: number;
    tollCacheAfter: number;
    fuseCacheBefore: number;
    fuseCacheAfter: number;
    fuseCacheExpiredBefore: number;
    fuseCacheExpiredAfter: number;
}

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
    routeSpecialKind: RouteSpecialKind | null;
    routeCardKind: RouteCardKind | null;
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
    hazardTilesBefore: number;
    hazardTilesAfter: number;
    hazardKinds: BoardTurnHazardKindFacts;
    scoutsBefore: number;
    scoutsAfter: number;
    omenScoutsBefore: number;
    omenScoutsAfter: number;
    mimicCacheBefore: number;
    mimicCacheAfter: number;
    mimicCacheBitesBefore: number;
    mimicCacheBitesAfter: number;
    mimicCacheGuardBitesBefore: number;
    mimicCacheGuardBitesAfter: number;
    routeSpecialsBefore: number;
    routeSpecialsAfter: number;
    safeHazardWardsUsedBefore: number;
    safeHazardWardsUsedAfter: number;
    /** Trait kinds actually involved in this turn, resolved here so the renderer never diffs trait counts. */
    matchedTraitKinds: TileTraitKind[];
    shopGoldBefore: number;
    shopGoldAfter: number;
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
    volatileTraitShufflesBefore: number;
    volatileTraitShufflesAfter: number;
    objectiveBefore: GameplayFeedbackObjectiveSnapshot | null;
    objectiveAfter: GameplayFeedbackObjectiveSnapshot | null;
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

/** Route-special tiles still present on the board, so the announcer never counts them itself. */
const routeSpecialCount = (run: RunState): number =>
    (run.board?.tiles ?? []).filter((tile) => tile.routeSpecialKind != null).length;

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
        // Read from the PRE-turn board: a matched tile can be removed from the resolved
        // board, and the route kind is what the player just interacted with.
        routeSpecialKind: firstTileValue(before, flippedTileIds, (tile) => tile.routeSpecialKind ?? null),
        routeCardKind: firstTileValue(before, flippedTileIds, (tile) => tile.routeCardKind ?? null),
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
        magpieTheftsBefore: runNonNegativeInteger(before.magpieTheftsThisFloor),
        magpieTheftsAfter: runNonNegativeInteger(after.magpieTheftsThisFloor),
        magpieScaredOffBefore: runNonNegativeInteger(before.magpieScaredOffThisFloor),
        magpieScaredOffAfter: runNonNegativeInteger(after.magpieScaredOffThisFloor),
        hazardTilesBefore: runNonNegativeInteger(before.hazardTileTriggersThisFloor),
        hazardTilesAfter: runNonNegativeInteger(after.hazardTileTriggersThisFloor),
        hazardKinds: {
            shuffleSnareBefore: runNonNegativeInteger(before.hazardShuffleSnaresThisFloor),
            shuffleSnareAfter: runNonNegativeInteger(after.hazardShuffleSnaresThisFloor),
            cascadeCacheBefore: runNonNegativeInteger(before.hazardCascadeCachesThisFloor),
            cascadeCacheAfter: runNonNegativeInteger(after.hazardCascadeCachesThisFloor),
            mirrorDecoyBefore: runNonNegativeInteger(before.hazardMirrorDecoysThisFloor),
            mirrorDecoyAfter: runNonNegativeInteger(after.hazardMirrorDecoysThisFloor),
            fragileCacheClaimBefore: runNonNegativeInteger(before.hazardFragileCacheClaimsThisFloor),
            fragileCacheClaimAfter: runNonNegativeInteger(after.hazardFragileCacheClaimsThisFloor),
            fragileCacheBreakBefore: runNonNegativeInteger(before.hazardFragileCacheBreaksThisFloor),
            fragileCacheBreakAfter: runNonNegativeInteger(after.hazardFragileCacheBreaksThisFloor),
            tollCacheBefore: runNonNegativeInteger(before.hazardTollCachesThisFloor),
            tollCacheAfter: runNonNegativeInteger(after.hazardTollCachesThisFloor),
            fuseCacheBefore: runNonNegativeInteger(before.hazardFuseCachesThisFloor),
            fuseCacheAfter: runNonNegativeInteger(after.hazardFuseCachesThisFloor),
            fuseCacheExpiredBefore: runNonNegativeInteger(before.hazardFuseCacheExpiredClaimsThisFloor),
            fuseCacheExpiredAfter: runNonNegativeInteger(after.hazardFuseCacheExpiredClaimsThisFloor)
        },
        scoutsBefore: runNonNegativeInteger(before.lanternWardScoutsThisFloor),
        scoutsAfter: runNonNegativeInteger(after.lanternWardScoutsThisFloor),
        omenScoutsBefore: runNonNegativeInteger(before.omenSealScoutsThisFloor),
        omenScoutsAfter: runNonNegativeInteger(after.omenSealScoutsThisFloor),
        mimicCacheBefore: runNonNegativeInteger(before.mimicCacheClaimsThisFloor),
        mimicCacheAfter: runNonNegativeInteger(after.mimicCacheClaimsThisFloor),
        mimicCacheBitesBefore: runNonNegativeInteger(before.mimicCacheBitesThisFloor),
        mimicCacheBitesAfter: runNonNegativeInteger(after.mimicCacheBitesThisFloor),
        mimicCacheGuardBitesBefore: runNonNegativeInteger(before.mimicCacheGuardBitesThisFloor),
        mimicCacheGuardBitesAfter: runNonNegativeInteger(after.mimicCacheGuardBitesThisFloor),
        routeSpecialsBefore: routeSpecialCount(before),
        routeSpecialsAfter: routeSpecialCount(after),
        safeHazardWardsUsedBefore: runNonNegativeInteger(before.safeHazardWardsUsedThisFloor),
        safeHazardWardsUsedAfter: runNonNegativeInteger(after.safeHazardWardsUsedThisFloor),
        matchedTraitKinds: TILE_TRAIT_COUNT_KINDS.filter((kind) =>
            flippedTileIds.some(
                (tileId) => before.board?.tiles.find((tile) => tile.id === tileId)?.tileTraitKind === kind
            )
        ),
        shopGoldBefore: runNonNegativeInteger(before.shopGold),
        shopGoldAfter: runNonNegativeInteger(after.shopGold),
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
        mismatchesAfter: statsAfter.mismatches,
        volatileTraitShufflesBefore: runNonNegativeInteger(statsBefore.volatileTraitShuffles),
        volatileTraitShufflesAfter: runNonNegativeInteger(statsAfter.volatileTraitShuffles),
        objectiveBefore: getGameplayFeedbackObjectiveSnapshot(before),
        objectiveAfter: getGameplayFeedbackObjectiveSnapshot(after)
    };
};
