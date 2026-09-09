import { MAGPIE_BEAT_COPY } from './magpieBeat';
import { CHAIN_BEAT_COPY, CHAIN_TIER_LABELS } from './chainBeat';
import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { getChainMilestoneFeedback } from './chainMilestoneFeedback';
import { getChainRewardForecastCues, getChainRewardUrgencyCopy } from './chainMomentum';
import { getFindableAnnouncementText } from './hudActionFeedback';

/** Chain lengths that earn a called-out milestone announcement. */
export const CHAIN_MILESTONE_THRESHOLDS = [3, 6, 10] as const;

const chainRewardAnnouncementLine = (streak: number, comboShards: number): string => {
    const cue = getChainRewardForecastCues(streak, comboShards)[0];
    return cue ? ` Next reward: ${getChainRewardUrgencyCopy(cue)}: ${cue.label} in ${cue.distanceLabel}.` : '';
};

/**
 * Chain-milestone announcement for a turn that crossed a threshold, derived from the
 * streak the core reported rather than from a remembered previous streak.
 */
export const chainMilestoneAnnouncement = (turnEvent: BoardTurnResolvedEvent): string | null => {
    const { currentStreakBefore, currentStreakAfter, comboShardsAfter } = turnEvent.announcement;
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
    const rewardLine = chainRewardAnnouncementLine(currentStreakAfter, comboShardsAfter);
    return milestone
        ? `${milestone.label}: ${milestone.target}. ${milestone.value}.${rewardLine}`
        : `Chain times ${crossed} - keep the chain for bigger match payouts.${rewardLine}`;
};

/**
 * A meaningful chain ending. Reported from the same before/after pair as the milestone,
 * so a turn that ends a chain of 3 or more says so exactly once.
 */
export const chainBreakAnnouncement = (turnEvent: BoardTurnResolvedEvent): string | null => {
    const { currentStreakBefore, currentStreakAfter, chainTierBefore } = turnEvent.announcement;
    if (currentStreakBefore < 3 || currentStreakAfter >= currentStreakBefore) {
        return null;
    }
    // A Sharp or Fever chain ending is the beat the table groans at: say which fire went out.
    if (chainTierBefore === 'sharp' || chainTierBefore === 'fever') {
        return `${CHAIN_TIER_LABELS[chainTierBefore]} chain x${currentStreakBefore} broken - the fire is out. Recover with a remembered pair.`;
    }
    return `Chain x${currentStreakBefore} broken - recover with a remembered pair.`;
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

export interface BoardTurnAnnouncementResult {
    lines: string[];
    dedupeKey: string;
    priority: 'info';
}

/**
 * The whole polite announcement for one resolved turn, projected from the event.
 *
 * Everything it reports - chain milestones, chunk breaks, pickups - comes from
 * before/after facts the core stamped on the event. The announcer previously kept seven
 * per-floor snapshot refs and inferred each of these by comparing renders, which meant
 * the spoken feedback could disagree with the rules and could double-fire or go silent
 * depending on render timing. Keyed on eventId, one turn announces once.
 */
/**
 * The magpie's line for a turn it visited on.
 *
 * Read from the event's own before/after counters like every other announcement here, rather than
 * from the run: the theft already happened by the time this is called, and diffing a snapshot would
 * be reconstructing what the core already said.
 */
export const magpieAnnouncementLines = (turnEvent: BoardTurnResolvedEvent): string[] => {
    const { magpieTheftsBefore, magpieTheftsAfter } = turnEvent.announcement;
    return magpieTheftsAfter > magpieTheftsBefore ? [MAGPIE_BEAT_COPY.theftAnnouncement] : [];
};

/**
 * The chunk's line for a turn where a chain broke one. Read off the event's counters, so the
 * renderer never has to diff boards to know pairs left.
 */
export const chunkAnnouncementLines = (turnEvent: BoardTurnResolvedEvent): string[] => {
    const { chunkPairsBrokenBefore, chunkPairsBrokenAfter, chainAfter, chainTierAfter } = turnEvent.announcement;
    const pairs = chunkPairsBrokenAfter - chunkPairsBrokenBefore;
    if (pairs <= 0) {
        return [];
    }
    const style = CHAIN_BEAT_COPY.styleLine(turnEvent.announcement);
    return [CHAIN_BEAT_COPY.chunkAnnouncement(pairs, chainTierAfter, chainAfter), ...(style ? [style] : [])];
};

export const buildBoardTurnAnnouncement = (
    turnEvent: BoardTurnResolvedEvent,
    _options: { reduceMotion: boolean }
): BoardTurnAnnouncementResult | null => {
    const lines = [
        chainMilestoneAnnouncement(turnEvent),
        chainBreakAnnouncement(turnEvent),
        /*
         * Ahead of the counters: the bird moved a pair, and a player who hears the score before
         * they hear that will already be looking in the wrong place.
         */
        ...chunkAnnouncementLines(turnEvent),
        ...magpieAnnouncementLines(turnEvent),
        getBoardTurnPickupAnnouncement(turnEvent)?.text ?? null
    ].filter((line): line is string => line != null && line.length > 0);

    if (lines.length === 0) {
        return null;
    }
    return { lines, dedupeKey: `board-turn:${turnEvent.eventId}`, priority: 'info' };
};
