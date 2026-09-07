import { describe, expect, it } from 'vitest';
import { createBoardTurnResolvedEventFixture } from '../../shared/test/gameplay-event-fixtures';
import { buildBoardTurnAnnouncement, chunkAnnouncementLines } from './boardTurnAnnouncement';
import { CHAIN_BEAT_COPY } from './chainBeat';

/* Same narrowing as magpieBeat.test.ts: the fixture is the whole event union. */
type BoardTurnEvent = Parameters<typeof chunkAnnouncementLines>[0];

const turnEvent = (announcement: Partial<BoardTurnEvent['announcement']>): BoardTurnEvent => {
    const base = createBoardTurnResolvedEventFixture({ commandId: 'chunk-test', outcome: 'match' }) as BoardTurnEvent;
    return { ...base, announcement: { ...base.announcement, ...announcement } };
};

describe('the chunk says something', () => {
    it('says nothing on a turn without a break', () => {
        expect(chunkAnnouncementLines(turnEvent({}))).toEqual([]);
    });

    it('names the chain, the tier and how many pairs left, because a silent break reads as a bug', () => {
        const lines = chunkAnnouncementLines(
            turnEvent({ chunkPairsBrokenBefore: 1, chunkPairsBrokenAfter: 4, chainAfter: 6, chainTierAfter: 'sharp' })
        );
        expect(lines).toEqual([CHAIN_BEAT_COPY.chunkAnnouncement(3, 'sharp', 6)]);
        expect(lines[0]).toMatch(/Chain 6/);
        expect(lines[0]).toMatch(/Sharp/);
        expect(lines[0]).toMatch(/3 more pairs/);
    });

    it('reaches the assembled turn announcement, not only its own helper', () => {
        const announced = buildBoardTurnAnnouncement(
            turnEvent({ chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 2, chainAfter: 3, chainTierAfter: 'clean' }),
            { reduceMotion: false }
        );
        expect(announced?.lines.join(' ')).toContain(CHAIN_BEAT_COPY.chunkAnnouncement(2, 'clean', 3));
    });
});

describe('the style line', () => {
    it('names only what applies, in one line, and says nothing about a plain break', () => {
        expect(CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 1, chunkHaloPairs: 0, chunkTreasuresSpilled: 0, chunkSuitCleared: false })).toBeNull();
        expect(
            CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 1, chunkHaloPairs: 0, chunkTreasuresSpilled: 0, chunkSuitCleared: false, chunkDroppedPairs: 2 })
        ).toBe('Drop ×2.');
        expect(
            CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 5, chunkHaloPairs: 1, chunkTreasuresSpilled: 2, chunkSuitCleared: true })
        ).toBe('Partner across the board, Halo, Treasure spill ×2, Clean sweep.');
        expect(CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 0, chunkHaloPairs: 0, chunkTreasuresSpilled: 1, chunkSuitCleared: false })).toBe(
            'Treasure spill.'
        );
    });

    it('follows the chunk announcement, so the break and its name arrive together', () => {
        const lines = chunkAnnouncementLines(
            turnEvent({
                chunkPairsBrokenBefore: 0,
                chunkPairsBrokenAfter: 2,
                chainAfter: 4,
                chainTierAfter: 'sharp',
                chunkPartnerSpanMax: 6,
                chunkHaloPairs: 0,
                chunkTreasuresSpilled: 0,
                chunkSuitCleared: false
            })
        );
        expect(lines).toEqual([CHAIN_BEAT_COPY.chunkAnnouncement(2, 'sharp', 4), 'Partner across the board.']);
    });
});
