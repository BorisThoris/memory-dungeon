import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { buildMismatchScorePopPayload } from '../store/matchScorePop';
import { buildBoardTurnAnnouncement, skittishAnnouncementLines } from './boardTurnAnnouncement';
import { SKITTISH_FLINCH_ANNOUNCEMENT } from './skittishCardsBeat';

type BoardTurnEvent = Parameters<typeof skittishAnnouncementLines>[0];

const turnEvent = (announcement: Partial<BoardTurnEvent['announcement']>): BoardTurnEvent => {
    const base = createBoardTurnResolvedEventFixture({
        commandId: 'skittish-test',
        outcome: 'mismatch'
    }) as BoardTurnEvent;
    return { ...base, announcement: { ...base.announcement, ...announcement } };
};

describe('skittish cards say when they flinch', () => {
    it('announces a flinch, and says one step rather than where', () => {
        expect(skittishAnnouncementLines(turnEvent({ skittishFlinchesBefore: 0, skittishFlinchesAfter: 1 }))).toEqual([
            SKITTISH_FLINCH_ANNOUNCEMENT
        ]);
        expect(SKITTISH_FLINCH_ANNOUNCEMENT).toMatch(/one step/);
    });

    it('says nothing on a miss that did not flinch', () => {
        expect(skittishAnnouncementLines(turnEvent({ skittishFlinchesBefore: 1, skittishFlinchesAfter: 1 }))).toEqual([]);
    });

    it('reaches the screen reader and marks the miss floater', () => {
        const flinched = turnEvent({ skittishFlinchesBefore: 0, skittishFlinchesAfter: 1 });
        const announcement = buildBoardTurnAnnouncement(flinched, { includePickup: false, reduceMotion: false });
        expect(announcement?.lines).toContain(SKITTISH_FLINCH_ANNOUNCEMENT);
        expect(buildMismatchScorePopPayload(flinched)?.flinched).toBe(true);
        expect(buildMismatchScorePopPayload(turnEvent({}))?.flinched).toBeUndefined();
    });
});
