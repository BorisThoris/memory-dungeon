import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { buildBoardTurnAnnouncement, magpieAnnouncementLines } from './boardTurnAnnouncement';
import { MAGPIE_BEAT_COPY } from './magpieBeat';

/*
 * The fixture is typed as the whole gameplay-event union, so the board-turn shape has to be named
 * to reach `announcement`. Narrowed rather than cast to `any`: the point of these tests is that the
 * announcement fields exist on the event the core actually emits.
 */
type BoardTurnEvent = Parameters<typeof magpieAnnouncementLines>[0];

const turnEvent = (announcement: Partial<BoardTurnEvent['announcement']>): BoardTurnEvent => {
    const base = createBoardTurnResolvedEventFixture({
        commandId: 'magpie-test',
        outcome: 'mismatch'
    }) as BoardTurnEvent;
    return { ...base, announcement: { ...base.announcement, ...announcement } };
};

describe('the magpie says something', () => {
    it('announces a theft, because a silent one is indistinguishable from misremembering', () => {
        // The whole reason this exists: a pair moves, the player looks where it was, and without a
        // line the only explanation available to them is that their own memory failed.
        expect(magpieAnnouncementLines(turnEvent({ magpieTheftsBefore: 0, magpieTheftsAfter: 1 }))).toEqual([
            MAGPIE_BEAT_COPY.theftAnnouncement
        ]);
    });

    it('announces a guard token being spent, or nobody would keep holding one', () => {
        expect(magpieAnnouncementLines(turnEvent({ magpieScaredOffBefore: 0, magpieScaredOffAfter: 1 }))).toEqual([
            MAGPIE_BEAT_COPY.scaredAnnouncement
        ]);
    });

    it('says nothing on a turn it did not visit', () => {
        expect(magpieAnnouncementLines(turnEvent({}))).toEqual([]);
    });

    it('reaches the run line a sighted player actually reads, not only the live region', () => {
        const announcement = buildBoardTurnAnnouncement(turnEvent({ magpieTheftsBefore: 0, magpieTheftsAfter: 1 }), {
            reduceMotion: false
        });
        expect(announcement?.lines.join(' ')).toContain(MAGPIE_BEAT_COPY.theftAnnouncement);
    });

    it('never says which pair or where it went, which would hand back what was taken', () => {
        const said = [MAGPIE_BEAT_COPY.theftAnnouncement, MAGPIE_BEAT_COPY.theftLine, MAGPIE_BEAT_COPY.theftBody];
        for (const line of said) {
            // A location or a pair identifier would give back exactly what the bird took. "a pair
            // you had cleared" is fine; "pair 3, top left" is not.
            expect(line).not.toMatch(/\brow \d|\bcolumn \d|top[- ]left|top[- ]right|bottom[- ]left|bottom[- ]right/iu);
            expect(line).not.toMatch(/\bpair [-\w]*\d/iu);
        }
    });
});
