import { describe, expect, it } from 'vitest';
import { lookingGlassAnnouncement } from './lookingGlassBeat';

describe('the looking glass announcement', () => {
    it('names the way the board turned and that what was known still holds', () => {
        expect(lookingGlassAnnouncement('left_right')).toMatch(/mirrored left to right/);
        expect(lookingGlassAnnouncement('top_bottom')).toMatch(/mirrored top to bottom/);
        expect(lookingGlassAnnouncement('left_right')).toMatch(/where its reflection was/);
    });
});
