import { describe, expect, it } from 'vitest';

import { auditGenerationClaims, readRepositoryFiles } from '../../scripts/audit-generation-claims';

/**
 * This repository keeps its history in its prose: six hundred sentences that name a generation and
 * say what it changed. Every one is a claim, and a claim nothing checks rots exactly the way a test
 * nobody runs does. Gen 184 removed the combo shards, and twenty-one generations later the
 * mechanics catalog still listed them in the future tense, pointing at three symbols that had gone
 * with them.
 *
 * The bar has failed - that is where it came from - so these cases hold the two rules open rather
 * than waiting for the repository to break them again.
 */
describe('the generation claim audit', () => {
    const file = (path: string, text: string) => ({ path, text });

    it('names a claim whose file no longer exists', () => {
        const report = auditGenerationClaims([
            file('docs/gameplay/live.md', 'Gen 184 banked shards in `combo-shard-rules.ts`.'),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.issues.map((issue) => issue.detail)).toEqual(['no file named combo-shard-rules.ts']);
    });

    it('names a claim whose symbol no longer exists', () => {
        const report = auditGenerationClaims([
            file('docs/gameplay/live.md', 'Gen 184 capped the bank at `MAX_COMBO_SHARDS`.'),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.issues.map((issue) => issue.detail)).toEqual(['no symbol named MAX_COMBO_SHARDS']);
    });

    it('lets a live document name what it says is gone', () => {
        // The rule is about tense, not about vocabulary: a page may say a thing was removed and
        // name it, which is how a reader finds out where it went.
        const report = auditGenerationClaims([
            file('docs/gameplay/live.md', 'The `MAX_COMBO_SHARDS` cap was removed in Gen 184.'),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.issues).toEqual([]);
    });

    it('lets a dated record describe the game it was written about', () => {
        const report = auditGenerationClaims([
            file('docs/BALANCE_NOTES.md', '- **Gen 130 relics touched the cascade (`relics.ts`):** measured at `CASCADE_RELIC_BANDS`.'),
            file('docs/REMOVED_LIVES.md', 'Gen 183 took `INITIAL_LIVES` with it.'),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.issues).toEqual([]);
    });

    it('names a claim still pending in a generation that has happened', () => {
        const report = auditGenerationClaims([
            file('docs/gameplay/live.md', '| Combo shards (capped; leave in Gen 184) | banked from the chain |'),
            // Shipped generations are read off the record of shipped work, not off every mention.
            file('docs/BALANCE_NOTES.md', '- **Gen 205 redrew the authored floors.**'),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.latestGeneration).toBe(205);
        expect(report.issues).toHaveLength(1);
        expect(report.issues[0]!.detail).toContain('still pending in a generation that has happened');
    });

    it('counts only the record\'s entry headings, not the prose inside them', () => {
        // The entry describing this rule quotes "lands in Gen 240" as its example, and counting
        // every mention let that example raise the ceiling and switch the rule off beneath it.
        const report = auditGenerationClaims([
            file(
                'docs/BALANCE_NOTES.md',
                ['- **Gen 205 redrew the authored floors.**', 'A plan that says it lands in Gen 240 is still a plan.'].join('\n')
            ),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.latestGeneration).toBe(205);
    });

    it('reads a generation still ahead of the repository as a plan, not a lie', () => {
        const report = auditGenerationClaims([
            file('docs/gameplay/live.md', 'The magpie counter lands in Gen 240.'),
            // Shipped generations are read off the record of shipped work, not off every mention.
            file('docs/BALANCE_NOTES.md', '- **Gen 205 redrew the authored floors.**'),
            file('src/shared/kept.ts', 'export const kept = 1;')
        ]);
        expect(report.issues).toEqual([]);
    });

    it('holds over the whole repository, which is the point of it', () => {
        const report = auditGenerationClaims(readRepositoryFiles());
        expect(report.issues).toEqual([]);
        // A count, so a rewrite that quietly drops the record from a document is visible here.
        expect(report.claims).toBeGreaterThan(500);
        expect(report.files).toBeGreaterThan(90);
    });
});
