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
    it('separates the remembered pair from the chain reward on the first floor', () => {
        expect(CHAIN_BEAT_COPY.rungValue('none')).toBe('Your match clears its pair. Reach Clean to start popping nearby pairs.');
        expect(CHAIN_BEAT_COPY.rungValue('clean')).toContain('up to 1 extra pair');
        expect(CHAIN_BEAT_COPY.rungValue('sharp')).toContain('up to 2 extra pairs');
        expect(CHAIN_BEAT_COPY.rungValue('fever')).toContain('up to 4 extra pairs');
        expect(CHAIN_BEAT_COPY.rungValue('fever')).toContain('Popped pairs score ×8 before ripple bonuses.');
    });

    it('teaches the breather bonus where the player reads the live meter', () => {
        expect(CHAIN_BEAT_COPY.meterLabel(0, 9, false, 'none', 'breather')).toContain('On this breather, a match can pop up to 1 extra pair');
        expect(CHAIN_BEAT_COPY.rungValue('clean', 'breather')).toContain('up to 2 extra pairs');
        expect(CHAIN_BEAT_COPY.rungValue('fever', 'breather')).toContain('up to 5 extra pairs');
        expect(CHAIN_BEAT_COPY.momentumHint(1, 0, 0, { sharp: 7, fever: 9 }, 'breather')).toContain('Clean from 3 can pop up to 2 extra pairs');
    });

    it('does not describe a cross-suit Fever bridge as clearing only one suit', () => {
        const lines = chunkAnnouncementLines(turnEvent({
            chunkPairsBrokenBefore: 0, chunkPairsBrokenAfter: 4, chainAfter: 9,
            chainTierAfter: 'fever', chunkBridgedPairs: 1
        }));
        expect(lines[0]).toContain('4 more pairs broke away');
        expect(lines.join(' ')).not.toContain('same suit');
        expect(lines).toContain('Bridge.');
    });

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
        expect(CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 1, chunkBridgedPairs: 0, chunkSuitCleared: false })).toBeNull();
        expect(
            CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 1, chunkBridgedPairs: 0, chunkSuitCleared: false, chunkDroppedPairs: 2 })
        ).toBe('Drop ×2.');
        expect(CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 5, chunkBridgedPairs: 1, chunkSuitCleared: true })).toBe(
            'Long clump, Bridge, Clean sweep.'
        );
        expect(CHAIN_BEAT_COPY.styleLine({ chunkPartnerSpanMax: 0, chunkBridgedPairs: 1, chunkSuitCleared: false })).toBe('Bridge.');
    });

    it('follows the chunk announcement, so the break and its name arrive together', () => {
        const lines = chunkAnnouncementLines(
            turnEvent({
                chunkPairsBrokenBefore: 0,
                chunkPairsBrokenAfter: 2,
                chainAfter: 4,
                chainTierAfter: 'sharp',
                chunkPartnerSpanMax: 6,
                chunkBridgedPairs: 0,
                chunkSuitCleared: false
            })
        );
        expect(lines).toEqual([CHAIN_BEAT_COPY.chunkAnnouncement(2, 'sharp', 4), 'Long clump.']);
    });
});
