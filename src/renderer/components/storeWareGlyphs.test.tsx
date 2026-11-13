import { describe, expect, it } from 'vitest';
import { RELIC_IDS } from '../../shared/run-relic-rules';
import { storeWareGlyph } from './storeWareGlyphs';

describe('the store wares as drawings', () => {
    // The playtest's store shots (2026-11-13) showed every relic that grows as the same plain dot.
    it('draws every ware the store can sell, never the bare fallback dot', () => {
        for (const id of ['miss', 'peek', 'shuffle', 'bomb', ...RELIC_IDS] as const) {
            expect(storeWareGlyph(id).type, id).toBe('g');
        }
    });
});
