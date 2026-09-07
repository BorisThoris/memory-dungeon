import { getHazardTileLiveCopy, HAZARD_TILE_KINDS } from '../../shared/hazard-tiles';
import { MAGPIE_BEAT_COPY } from './magpieBeat';
import { CHAIN_BEAT_COPY, CHAIN_TIER_LABELS } from './chainBeat';
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
 * per-kind before/after counts instead of a per-floor snapshot ref.
 *
 * Each kind is checked independently, so a turn that trips two hazards announces both in
 * HAZARD_TILE_KINDS order. Fragile and fuse caches carry a second, break-specific line:
 * a fragile cache can both claim and break in one turn, and a fuse cache claimed after
 * its fuse ran out reads differently from one claimed in time.
 */
export const hazardTileAnnouncementLines = (
    turnEvent: BoardTurnResolvedEvent,
    { reduceMotion }: { reduceMotion: boolean }
): string[] => {
    const { hazardTilesBefore, hazardTilesAfter, hazardKinds } = turnEvent.announcement;
    if (hazardTilesAfter <= hazardTilesBefore) {
        return [];
    }
    const fired = (before: number, after: number): boolean => after > before;
    return HAZARD_TILE_KINDS.flatMap((kind) => {
        const liveCopy = getHazardTileLiveCopy(kind);
        const normalLine = reduceMotion ? liveCopy.reducedMotionLiveAnnouncement : liveCopy.liveAnnouncement;
        const breakLine = reduceMotion
            ? liveCopy.reducedMotionBreakLiveAnnouncement ?? liveCopy.reducedMotionLiveAnnouncement
            : liveCopy.breakLiveAnnouncement ?? liveCopy.liveAnnouncement;
        switch (kind) {
            case 'shuffle_snare':
                return fired(hazardKinds.shuffleSnareBefore, hazardKinds.shuffleSnareAfter) ? [normalLine] : [];
            case 'cascade_cache':
                return fired(hazardKinds.cascadeCacheBefore, hazardKinds.cascadeCacheAfter) ? [normalLine] : [];
            case 'mirror_decoy':
                return fired(hazardKinds.mirrorDecoyBefore, hazardKinds.mirrorDecoyAfter) ? [normalLine] : [];
            case 'fragile_cache':
                return [
                    ...(fired(hazardKinds.fragileCacheClaimBefore, hazardKinds.fragileCacheClaimAfter)
                        ? [normalLine]
                        : []),
                    ...(fired(hazardKinds.fragileCacheBreakBefore, hazardKinds.fragileCacheBreakAfter)
                        ? [breakLine]
                        : [])
                ];
            case 'toll_cache':
                return fired(hazardKinds.tollCacheBefore, hazardKinds.tollCacheAfter) ? [normalLine] : [];
            default:
                if (!fired(hazardKinds.fuseCacheBefore, hazardKinds.fuseCacheAfter)) {
                    return [];
                }
                return [
                    fired(hazardKinds.fuseCacheExpiredBefore, hazardKinds.fuseCacheExpiredAfter)
                        ? breakLine
                        : normalLine
                ];
        }
    }).filter((line): line is string => typeof line === 'string' && line.length > 0);
};

/**
 * The volatile trait reshuffling hidden cards. Reported from the event so the announcer
 * never has to diff a run-stats counter it also renders.
 */
export const volatileShuffleAnnouncementLine = (turnEvent: BoardTurnResolvedEvent): string | null =>
    turnEvent.announcement.volatileTraitShufflesAfter > turnEvent.announcement.volatileTraitShufflesBefore
        ? 'Volatile trait shuffled hidden cards.'
        : null;

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
    if (turnEvent.announcement.omenScoutsAfter > turnEvent.announcement.omenScoutsBefore) {
        lines.push('Omen Seal revealed hidden danger.');
    }
    // A bite and a claim are mutually exclusive readings of the same cache, and a bite
    // the guard absorbed reads differently from one that cost a life.
    if (turnEvent.announcement.mimicCacheBitesAfter > turnEvent.announcement.mimicCacheBitesBefore) {
        lines.push(
            turnEvent.announcement.mimicCacheGuardBitesAfter > turnEvent.announcement.mimicCacheGuardBitesBefore
                ? 'Mimic Cache bit. Guard absorbed the hit.'
                : 'Mimic Cache bit. Life lost; reduced loot claimed.'
        );
    } else if (mimicCacheAfter > mimicCacheBefore) {
        lines.push('Mimic Cache controlled. Full loot claimed.');
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
/**
 * The magpie's line for a turn it visited on.
 *
 * Read from the event's own before/after counters like every other announcement here, rather than
 * from the run: the theft already happened by the time this is called, and diffing a snapshot would
 * be reconstructing what the core already said.
 */
export const magpieAnnouncementLines = (turnEvent: BoardTurnResolvedEvent): string[] => {
    const { magpieTheftsBefore, magpieTheftsAfter, magpieScaredOffBefore, magpieScaredOffAfter } =
        turnEvent.announcement;
    return [
        ...(magpieTheftsAfter > magpieTheftsBefore ? [MAGPIE_BEAT_COPY.theftAnnouncement] : []),
        ...(magpieScaredOffAfter > magpieScaredOffBefore ? [MAGPIE_BEAT_COPY.scaredAnnouncement] : [])
    ];
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
    { reduceMotion }: { reduceMotion: boolean }
): BoardTurnAnnouncementResult | null => {
    const lines = [
        chainMilestoneAnnouncement(turnEvent),
        chainBreakAnnouncement(turnEvent),
        ...hazardTileAnnouncementLines(turnEvent, { reduceMotion }),
        /*
         * Ahead of the counters: the bird moved a pair, and a player who hears the score before
         * they hear that will already be looking in the wrong place.
         */
        ...chunkAnnouncementLines(turnEvent),
        ...magpieAnnouncementLines(turnEvent),
        ...counterAnnouncementLines(turnEvent),
        getBoardTurnPickupAnnouncement(turnEvent)?.text ?? null
    ].filter((line): line is string => line != null && line.length > 0);

    if (lines.length === 0) {
        return null;
    }
    return { lines, dedupeKey: `board-turn:${turnEvent.eventId}`, priority: 'info' };
};
