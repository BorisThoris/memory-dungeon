import { describe, expect, it } from 'vitest';
import { TILE_TRAIT_COPY, TILE_TRAIT_INTERACTION_TAGS, TILE_TRAIT_INTERACTION_TEXT } from './tile-trait-rules';
import { getTileTraitCodexRows, getTileTraitInteractionCodexRows } from './tile-trait-codex';
import { describeTraitMark, tileTraitMark } from './tile-trait-marks';
import type { TileTraitKind } from './contracts';

describe('tile trait codex rows', () => {
    it('documents every trait kind from player-facing trait copy', () => {
        const rows = getTileTraitCodexRows();

        expect(rows).toHaveLength(Object.keys(TILE_TRAIT_COPY).length);
        // Each row leads with the trait's label and then the mark drawn on a hidden tile, so a
        // player can look up "two bars" as readily as "Sealed".
        expect(rows.map((row) => row.title)).toEqual(
            expect.arrayContaining(['Echo · 2 dots', 'Volatile · 3 diamonds', 'Conduit · 1 dot'])
        );
        for (const kind of Object.keys(TILE_TRAIT_COPY) as TileTraitKind[]) {
            const row = rows.find((candidate) => candidate.id === `trait-${kind}`);
            expect(row?.title).toBe(`${TILE_TRAIT_COPY[kind].label} · ${describeTraitMark(tileTraitMark(kind))}`);
        }
        expect(rows.every((row) => row.description.includes('Match:') && row.description.includes('Miss:'))).toBe(true);
    });

    it('documents every interaction tag from the live interaction text table', () => {
        const rows = getTileTraitInteractionCodexRows();

        expect(rows).toHaveLength(TILE_TRAIT_INTERACTION_TAGS.length);
        expect(rows.map((row) => row.id)).toEqual(
            TILE_TRAIT_INTERACTION_TAGS.map((tag) => `trait-interaction-${tag}`)
        );
        for (const tag of TILE_TRAIT_INTERACTION_TAGS) {
            expect(rows.find((row) => row.title === TILE_TRAIT_INTERACTION_TEXT[tag])?.description).toMatch(/\S/);
        }
    });
});
