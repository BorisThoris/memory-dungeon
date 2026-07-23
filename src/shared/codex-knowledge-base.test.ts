import { describe, expect, it } from 'vitest';
import { ACHIEVEMENTS } from './achievements';
import { MUTATOR_IDS } from './contracts';
import { getCodexKnowledgeBaseRows, getCodexKnowledgeSectionRows } from './codex-knowledge-base';
import { RELIC_POOL } from './relics';

describe('REG-095 codex knowledge base rows', () => {
    it('summarizes guide/table/deep-link depth from encyclopedia sources', () => {
        const rows = getCodexKnowledgeBaseRows();

        expect(rows.map((row) => row.id)).toEqual(['guide_depth', 'table_depth', 'deep_links', 'filter_recovery']);
        expect(rows.every((row) => row.localOnly)).toBe(true);
        expect(rows.find((row) => row.id === 'guide_depth')?.count).toBeGreaterThan(0);
        expect(rows.find((row) => row.id === 'filter_recovery')?.action).toMatch(/clear/i);
    });

    it('counts reference table depth from stable catalog row sources', () => {
        const rows = getCodexKnowledgeSectionRows();

        expect(rows.find((row) => row.id === 'achievements')?.entryCount).toBe(ACHIEVEMENTS.length);
        expect(rows.find((row) => row.id === 'relics')?.entryCount).toBe(RELIC_POOL.length);
        expect(rows.find((row) => row.id === 'mutators')?.entryCount).toBe(MUTATOR_IDS.length);
        expect(rows.find((row) => row.id === 'tables')?.entryCount).toBe(
            ACHIEVEMENTS.length + RELIC_POOL.length + MUTATOR_IDS.length
        );
    });
});
