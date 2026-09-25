import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { ANCHOR_CLAIMED_ANNOUNCEMENT, ANCHOR_MARKED_ANNOUNCEMENT } from './anchorBeat';
import { anchorAnnouncementLines } from './boardTurnAnnouncement';

type BoardTurnEvent = Parameters<typeof anchorAnnouncementLines>[0];

const turnEvent = (announcement: Partial<BoardTurnEvent['announcement']>): BoardTurnEvent => {
    const base = createBoardTurnResolvedEventFixture({ commandId: 'anchor-test', outcome: 'match' }) as BoardTurnEvent;
    return { ...base, announcement: { ...base.announcement, ...announcement } };
};

describe('the anchor says what happened', () => {
    it('announces a claim, then the new mark, and nothing on a quiet turn', () => {
        expect(anchorAnnouncementLines(turnEvent({ anchorClaimsBefore: 0, anchorClaimsAfter: 1, anchorMoved: true }))).toEqual([
            ANCHOR_CLAIMED_ANNOUNCEMENT,
            ANCHOR_MARKED_ANNOUNCEMENT
        ]);
        expect(anchorAnnouncementLines(turnEvent({ anchorMoved: true }))).toEqual([ANCHOR_MARKED_ANNOUNCEMENT]);
        expect(anchorAnnouncementLines(turnEvent({}))).toEqual([]);
    });
});
