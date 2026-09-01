import type { BoardTurnResolvedEvent } from '../store/gameplayFeedbackAdapter';
import { getFindableAnnouncementText } from './hudActionFeedback';

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
