import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { buildBoardTurnAnnouncement, restlessAnnouncementLines } from './boardTurnAnnouncement';

type BoardTurnEvent = Parameters<typeof restlessAnnouncementLines>[0];

const turnEvent = (announcement: Partial<BoardTurnEvent['announcement']>): BoardTurnEvent => {
    const base = createBoardTurnResolvedEventFixture({
        commandId: 'restless-test',
        outcome: 'mismatch'
    }) as BoardTurnEvent;
    return { ...base, announcement: { ...base.announcement, ...announcement } };
};

describe('the restless floor says something', () => {
    it('announces a drift with how many pairs moved, escalating with the drift count', () => {
        expect(restlessAnnouncementLines(turnEvent({ restlessDriftsBefore: 0, restlessDriftsAfter: 1 }))).toEqual([
            'The floor shifted. one pair of hidden cards traded places somewhere on the board.'
        ]);
        expect(restlessAnnouncementLines(turnEvent({ restlessDriftsBefore: 1, restlessDriftsAfter: 2 }))).toEqual([
            'The floor shifted. two pairs of hidden cards traded places somewhere on the board.'
        ]);
        expect(restlessAnnouncementLines(turnEvent({ restlessDriftsBefore: 5, restlessDriftsAfter: 6 }))).toEqual([
            'The floor shifted. three pairs of hidden cards traded places somewhere on the board.'
        ]);
    });

    it('says nothing on a turn the floor held still', () => {
        expect(restlessAnnouncementLines(turnEvent({ restlessDriftsBefore: 2, restlessDriftsAfter: 2 }))).toEqual([]);
    });

    it('reaches the board-turn announcement the screen reader hears', () => {
        const announcement = buildBoardTurnAnnouncement(turnEvent({ restlessDriftsBefore: 0, restlessDriftsAfter: 1 }), {
            includePickup: false,
            reduceMotion: false
        });
        expect(announcement?.lines.some((line) => /The floor shifted/.test(line))).toBe(true);
    });
});
