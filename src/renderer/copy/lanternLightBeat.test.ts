import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { buildBoardTurnAnnouncement, lanternAnnouncementLines } from './boardTurnAnnouncement';
import { lanternLitAnnouncement } from './lanternLightBeat';

type BoardTurnEvent = Parameters<typeof lanternAnnouncementLines>[0];

const turnEvent = (announcement: Partial<BoardTurnEvent['announcement']>): BoardTurnEvent => {
    const base = createBoardTurnResolvedEventFixture({ commandId: 'lantern-test', outcome: 'match' }) as BoardTurnEvent;
    return { ...base, announcement: { ...base.announcement, ...announcement } };
};

describe('the lantern says what it lit', () => {
    it('counts the lit cards and says when they go dark', () => {
        expect(lanternLitAnnouncement(1)).toBe('The lantern lit one card beside the pair, until you turn the next one.');
        expect(lanternLitAnnouncement(3)).toBe('The lantern lit three cards beside the pair, until you turn the next one.');
    });

    it('says nothing when nothing was lit, and reaches the screen reader when something was', () => {
        expect(lanternAnnouncementLines(turnEvent({ lanternLitCount: 0 }))).toEqual([]);
        const announcement = buildBoardTurnAnnouncement(turnEvent({ lanternLitCount: 2 }), { includePickup: false, reduceMotion: false });
        expect(announcement?.lines).toContain(lanternLitAnnouncement(2));
    });
});
