import { getHazardTileLiveCopy, HAZARD_TILE_KINDS } from '../../shared/hazard-tiles';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { getChainMilestoneFeedback } from './chainMilestoneFeedback';
import { getChainRewardForecastCues, getChainRewardUrgencyCopy } from './chainMomentum';
import { getFindableAnnouncementText } from './hudActionFeedback';

/** Chain lengths that earn a called-out milestone announcement. */
export const CHAIN_MILESTONE_THRESHOLDS = [3, 6, 10] as const;

const chainRewardAnnouncementLine = (streak: number, comboShards: number, lives: number): string => {
    const cue = getChainRewardForecastCues(streak, comboShards, lives)[0];
    return cue ? ` Next reward: ${getChainRewardUrgencyCopy(cue)}: ${cue.label} in ${cue.distanceLabel}.` : '';
};

/**
 * Hazard-tile live copy for the hazards this turn actually fired, taken from the event's
 * before/after counts instead of a per-floor snapshot ref.
 */
export const hazardTileAnnouncementLines = (
    turnEvent: BoardTurnResolvedEvent,
    { reduceMotion }: { reduceMotion: boolean }
): string[] => {
    if (turnEvent.announcement.hazardTilesAfter <= turnEvent.announcement.hazardTilesBefore) {
        return [];
    }
    return HAZARD_TILE_KINDS.flatMap((kind) => {
        const liveCopy = getHazardTileLiveCopy(kind);
        const line = reduceMotion ? liveCopy.reducedMotionLiveAnnouncement : liveCopy.liveAnnouncement;
        return line ? [line] : [];
    }).slice(0, 1);
};

/**
 * Chain-milestone announcement for a turn that crossed a threshold, derived from the
 * streak the core reported rather than from a remembered previous streak.
 */
export const chainMilestoneAnnouncement = (turnEvent: BoardTurnResolvedEvent): string | null => {
    const { currentStreakBefore, currentStreakAfter, comboShardsAfter, livesAfter } = turnEvent.announcement;
    if (currentStreakAfter <= currentStreakBefore) {
        return null;
    }
    const crossed = CHAIN_MILESTONE_THRESHOLDS.find(
        (threshold) => currentStreakBefore < threshold && currentStreakAfter >= threshold
    );
    if (crossed === undefined) {
        return null;
    }
    const milestone = getChainMilestoneFeedback(currentStreakBefore, currentStreakAfter);
    const rewardLine = chainRewardAnnouncementLine(currentStreakAfter, comboShardsAfter, livesAfter);
    return milestone
        ? `${milestone.label}: ${milestone.target}. ${milestone.value}.${rewardLine}`
        : `Chain times ${crossed} - keep the chain for bigger match payouts.${rewardLine}`;
};

export interface BoardTurnAnnouncement {
    text: string;
    dedupeKey: string;
    priority: 'info';
}

/**
 * Polite live-region copy for a resolved turn, derived from the typed event.
 *
 * This replaces a board-snapshot diff: the announcer used to keep a ref of the previous
 * tiles and infer which findable had been claimed by comparing them. The core already
 * reports that as `matchedFindableKind`, so the announcement is now a pure function of
 * the event and cannot drift from what the rules actually did.
 *
 * The dedupe key is anchored to `eventId`, which is unique per resolved turn, so
 * re-renders never re-announce a turn and two identical pickups on different turns are
 * both announced.
 */
export const getBoardTurnPickupAnnouncement = (
    turnEvent: BoardTurnResolvedEvent
): BoardTurnAnnouncement | null => {
    if (turnEvent.matchedFindableKind == null) {
        return null;
    }
    if (turnEvent.announcement.findablesClaimedAfter <= turnEvent.announcement.findablesClaimedBefore) {
        return null;
    }
    return {
        text: getFindableAnnouncementText(turnEvent.matchedFindableKind),
        dedupeKey: `board-turn:${turnEvent.eventId}:pickup:${turnEvent.matchedFindableKind}`,
        priority: 'info'
    };
};

/**
 * Announcements for the remaining event-reported channels. Each fires on its own
 * before/after pair, so a turn that both scouts and claims reports both, and a turn that
 * changes neither stays silent - the snapshot refs these replace could only track one
 * counter per floor and lost interleaved events.
 */
const counterAnnouncementLines = (turnEvent: BoardTurnResolvedEvent): string[] => {
    const {
        scoutsBefore,
        scoutsAfter,
        mimicCacheBefore,
        mimicCacheAfter,
        routeSpecialsBefore,
        routeSpecialsAfter,
        safeHazardWardsUsedBefore,
        safeHazardWardsUsedAfter
    } = turnEvent.announcement;
    const lines: string[] = [];
    if (scoutsAfter > scoutsBefore) {
        lines.push('Lantern Ward scouted a hidden threat.');
    }
    if (mimicCacheAfter > mimicCacheBefore) {
        lines.push('Mimic Cache claimed.');
    }
    if (routeSpecialsAfter < routeSpecialsBefore) {
        lines.push('Route special resolved.');
    }
    if (safeHazardWardsUsedAfter > safeHazardWardsUsedBefore) {
        lines.push('Guard Cache ward blocked a hazard.');
    }
    return lines;
};

export interface BoardTurnAnnouncementResult {
    lines: string[];
    dedupeKey: string;
    priority: 'info';
}

/**
 * The whole polite announcement for one resolved turn, projected from the event.
 *
 * Everything it reports - chain milestones, hazard-tile firings, pickups - comes from
 * before/after facts the core stamped on the event. The announcer previously kept seven
 * per-floor snapshot refs and inferred each of these by comparing renders, which meant
 * the spoken feedback could disagree with the rules and could double-fire or go silent
 * depending on render timing. Keyed on eventId, one turn announces once.
 */
export const buildBoardTurnAnnouncement = (
    turnEvent: BoardTurnResolvedEvent,
    { reduceMotion }: { reduceMotion: boolean }
): BoardTurnAnnouncementResult | null => {
    const lines = [
        chainMilestoneAnnouncement(turnEvent),
        ...hazardTileAnnouncementLines(turnEvent, { reduceMotion }),
        ...counterAnnouncementLines(turnEvent),
        getBoardTurnPickupAnnouncement(turnEvent)?.text ?? null
    ].filter((line): line is string => line != null && line.length > 0);

    if (lines.length === 0) {
        return null;
    }
    return { lines, dedupeKey: `board-turn:${turnEvent.eventId}`, priority: 'info' };
};
