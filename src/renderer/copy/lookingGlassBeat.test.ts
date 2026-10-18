import { describe, expect, it } from 'vitest';
import { lookingGlassAnnouncement, lookingGlassHudTitle, lookingGlassLegendEntry } from './lookingGlassBeat';

describe('the looking glass announcement', () => {
    it('names the way the board turned and that what was known still holds', () => {
        expect(lookingGlassAnnouncement('left_right')).toMatch(/mirrored left to right/);
        expect(lookingGlassAnnouncement('top_bottom')).toMatch(/mirrored top to bottom/);
        expect(lookingGlassAnnouncement('left_right')).toMatch(/where its reflection was/);
    });

    it('gives the HUD the clock the board cannot show', () => {
        expect(lookingGlassHudTitle(3)).toBe('Looking glass \u00b7 turns in 3 matches');
        expect(lookingGlassHudTitle(1)).toBe('Looking glass \u00b7 turns on your next match');
    });

    it('keeps its clock in the key above the board, the count in the mark', () => {
        expect(lookingGlassLegendEntry(2)).toMatchObject({ id: 'looking_glass', name: 'Looking glass', sand: 2, line: 'mirrors the board in 2 matches' });
        expect(lookingGlassLegendEntry(1).line).toBe('mirrors the board on your next match');
    });
});
