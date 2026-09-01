import type { RouteCardKind, RouteSpecialKind, TileTraitKind, RunState } from './contracts';
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
export interface BoardTurnAnnouncementFacts {
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
    scoutsBefore: number;
    scoutsAfter: number;
    mimicCacheBefore: number;
    mimicCacheAfter: number;
    routeSpecialsBefore: number;
    routeSpecialsAfter: number;
    safeHazardWardsUsedBefore: number;
    safeHazardWardsUsedAfter: number;
    /** Trait kinds actually involved in this turn, resolved here so the renderer never diffs trait counts. */
    matchedTraitKinds: TileTraitKind[];
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
        hazardTilesBefore: runNonNegativeInteger(before.hazardTileTriggersThisFloor),
        hazardTilesAfter: runNonNegativeInteger(after.hazardTileTriggersThisFloor),
        scoutsBefore: runNonNegativeInteger(before.lanternWardScoutsThisFloor),
        scoutsAfter: runNonNegativeInteger(after.lanternWardScoutsThisFloor),
        mimicCacheBefore: runNonNegativeInteger(before.mimicCacheClaimsThisFloor),
        mimicCacheAfter: runNonNegativeInteger(after.mimicCacheClaimsThisFloor),
        routeSpecialsBefore: routeSpecialCount(before),
        routeSpecialsAfter: routeSpecialCount(after),
        safeHazardWardsUsedBefore: runNonNegativeInteger(before.safeHazardWardsUsedThisFloor),
        safeHazardWardsUsedAfter: runNonNegativeInteger(after.safeHazardWardsUsedThisFloor),
        matchedTraitKinds: TILE_TRAIT_COUNT_KINDS.filter((kind) =>
            flippedTileIds.some(
                (tileId) => before.board?.tiles.find((tile) => tile.id === tileId)?.tileTraitKind === kind
            )
        ),
        objectiveBefore: getGameplayFeedbackObjectiveSnapshot(before),
        objectiveAfter: getGameplayFeedbackObjectiveSnapshot(after)
    };
};
