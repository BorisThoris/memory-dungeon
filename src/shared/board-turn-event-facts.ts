import type { RouteCardKind, RouteSpecialKind, RunState } from './contracts';
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

export const getBoardTurnAnnouncementFacts = (
    run: RunState,
    nextRun: RunState,
    flippedTileIds: readonly string[] = [],
    outcome: 'match' | 'mismatch' | 'gambit_match' | 'gambit_mismatch' = 'match'
): BoardTurnAnnouncementFacts => {
    const statsBefore = normalizeSessionStats(run.stats);
    const statsAfter = normalizeSessionStats(nextRun.stats);
    // Selected by outcome, not by falling through: a gambit match resolves three tiles
    // and only the match anchor knows which two actually paired. Falling back to the
    // mismatch anchor would put the floater on the odd tile out.
    const anchor =
        outcome === 'match' || outcome === 'gambit_match'
            ? getMatchFloaterAnchorTileIds(run)
            : getMismatchFloaterAnchorTileIds(run);
    return {
        anchorTileIds: anchor
            ? [
                  anchor.tileIdA,
                  anchor.tileIdB,
                  ...('tileIdC' in anchor && typeof anchor.tileIdC === 'string' ? [anchor.tileIdC] : [])
              ]
            : [...flippedTileIds],
        level: runNonNegativeInteger(run.board?.level),
        // Read from the PRE-turn board: a matched tile can be removed from the resolved
        // board, and the route kind is what the player just interacted with.
        routeSpecialKind: firstTileValue(run, flippedTileIds, (tile) => tile.routeSpecialKind ?? null),
        routeCardKind: firstTileValue(run, flippedTileIds, (tile) => tile.routeCardKind ?? null),
        currentStreakBefore: statsBefore.currentStreak,
        currentStreakAfter: statsAfter.currentStreak,
        comboShardsBefore: statsBefore.comboShards,
        comboShardsAfter: statsAfter.comboShards,
        guardTokensBefore: runNonNegativeInteger(statsBefore.guardTokens),
        guardTokensAfter: runNonNegativeInteger(statsAfter.guardTokens),
        livesBefore: runNonNegativeInteger(run.lives),
        livesAfter: runNonNegativeInteger(nextRun.lives),
        findablesClaimedBefore: runNonNegativeInteger(run.findablesClaimedThisFloor),
        findablesClaimedAfter: runNonNegativeInteger(nextRun.findablesClaimedThisFloor),
        findablesTotalBefore: runNonNegativeInteger(run.findablesTotalThisFloor),
        findablesTotalAfter: runNonNegativeInteger(nextRun.findablesTotalThisFloor)
    };
};
