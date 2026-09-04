import { describe, expect, it } from 'vitest';
import { BUILTIN_PUZZLES } from './builtin-puzzles';
import { buildRunShareText } from './run-share-text';
import { createNewRun, createPuzzleRun, createWildRun } from './run-creation-rules';

describe('buildRunShareText', () => {
    it('names the game, the mode, the floor and the score, then the recipe', () => {
        const run = createNewRun(0);
        const share = buildRunShareText(run);
        expect(share.shareable).toBe(true);
        expect(share.text).toContain('Memory Dungeon');
        expect(share.text).toContain('Classic Dungeon');
        expect(share.text).toMatch(/floor \d+/u);
        expect(share.text).toMatch(/Same run: md1:classic:\d+:\d+$/u);
    });

    it('carries the mode a player actually picked, in the name and in the key', () => {
        // A wild run is an endless run underneath. Both halves of the line have to say so, or the
        // key hands someone a Classic run on the same board and calls it the same run.
        const share = buildRunShareText(createWildRun(0));
        expect(share.text).toContain('Wild Run');
        expect(share.text).toMatch(/Same run: md1:wild:/u);
    });

    it('prefers the finished run summary over live state, since that is the result', () => {
        const run = createNewRun(0);
        const finished = {
            ...run,
            lastRunSummary: { ...run.lastRunSummary, highestLevel: 14, totalScore: 2340 } as typeof run.lastRunSummary
        };
        const share = buildRunShareText(finished as typeof run);
        expect(share.text).toContain('floor 14');
        expect(share.text).toContain('2,340');
    });

    it('refuses to invent a key for a puzzle board, and says so instead of failing', () => {
        const puzzle = BUILTIN_PUZZLES.starter_pairs;
        const share = buildRunShareText(createPuzzleRun(0, puzzle.id, puzzle.tiles, 1));
        expect(share.shareable).toBe(false);
        expect(share.text).toContain('is its tiles, not a seed');
        expect(share.text).not.toContain('Same run:');
    });
});
