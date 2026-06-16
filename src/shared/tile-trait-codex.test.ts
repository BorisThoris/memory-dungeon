import { describe, expect, it } from 'vitest';
import { TILE_TRAIT_COPY, TILE_TRAIT_INTERACTION_TAGS, TILE_TRAIT_INTERACTION_TEXT } from './tile-trait-rules';
import { getTileTraitCodexRows, getTileTraitInteractionCodexRows } from './tile-trait-codex';

describe('tile trait codex rows', () => {
    it('documents every trait kind from player-facing trait copy', () => {
        const rows = getTileTraitCodexRows();

        expect(rows).toHaveLength(Object.keys(TILE_TRAIT_COPY).length);
        expect(rows.map((row) => row.title)).toEqual(expect.arrayContaining(['Echo', 'Volatile', 'Conduit']));
        expect(rows.every((row) => row.description.includes('Match:') && row.description.includes('Miss:'))).toBe(true);
    });

    it('documents every interaction tag from the live interaction text table', () => {
        const rows = getTileTraitInteractionCodexRows();

        expect(rows).toHaveLength(TILE_TRAIT_INTERACTION_TAGS.length);
        for (const tag of TILE_TRAIT_INTERACTION_TAGS) {
            expect(rows.find((row) => row.title === TILE_TRAIT_INTERACTION_TEXT[tag])?.description).toMatch(/\S/);
        }
    });
});

