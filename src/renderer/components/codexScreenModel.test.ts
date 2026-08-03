import { describe, expect, it } from 'vitest';
import { MUTATOR_IDS } from '../../shared/contracts';
import { RELIC_POOL } from '../../shared/relics';
import {
    buildCodexBuildRows,
    buildCodexModeRows,
    buildCodexMutatorRows,
    buildCodexRelicRows,
    CODEX_TOC,
    codexTabAllows,
    filterTopics,
    hasCodexFilterMatch,
    tocVisible
} from './codexScreenModel';

describe('codexScreenModel', () => {
    it('filters topics by title or description and preserves all rows for blank queries', () => {
        const topics = [
            { id: 'one', title: 'Echo', description: 'Copies adjacent trait payoff' },
            { id: 'two', title: 'Sealed', description: 'Blocks one next-turn match lane' }
        ];

        expect(filterTopics(topics, '').map((topic) => topic.id)).toEqual(['one', 'two']);
        expect(filterTopics(topics, 'adjacent').map((topic) => topic.id)).toEqual(['one']);
        expect(filterTopics(topics, 'sealed').map((topic) => topic.id)).toEqual(['two']);
    });

    it('keeps guide and table visibility aligned with the active tab', () => {
        expect(codexTabAllows('all', 'guide')).toBe(true);
        expect(codexTabAllows('all', 'table')).toBe(true);
        expect(codexTabAllows('guides', 'guide')).toBe(true);
        expect(codexTabAllows('guides', 'table')).toBe(false);
        expect(codexTabAllows('tables', 'guide')).toBe(false);
        expect(codexTabAllows('tables', 'table')).toBe(true);
        expect(CODEX_TOC.filter((item) => tocVisible('tables', item.kind)).map((item) => item.label)).toEqual([
            'Achievements',
            'Relics',
            'Mutators'
        ]);
    });

    it('detects matches only in sections allowed by the selected tab', () => {
        expect(hasCodexFilterMatch({ guideCounts: [0, 1], tableCounts: [0], tab: 'guides' })).toBe(true);
        expect(hasCodexFilterMatch({ guideCounts: [0, 1], tableCounts: [0], tab: 'tables' })).toBe(false);
        expect(hasCodexFilterMatch({ guideCounts: [0], tableCounts: [1], tab: 'tables' })).toBe(true);
    });

    it('builds player-facing mode and relic build rows', () => {
        expect(buildCodexModeRows().some((row) => row.id === 'visual_endless_locked')).toBe(true);
        expect(buildCodexBuildRows().some((row) => row.title === 'The Conduit Cartographer' && /peek, pin, read/i.test(row.description))).toBe(true);
        expect(buildCodexBuildRows().some((row) => row.title === 'The Emergency Toolkit' && /inspect, remove, recover/i.test(row.description))).toBe(true);
    });

    it('builds relic and mutator tables through shared catalog row order', () => {
        expect(buildCodexRelicRows().map((row) => row.id)).toEqual([...RELIC_POOL]);
        expect(buildCodexMutatorRows().map((row) => row.id)).toEqual([...MUTATOR_IDS]);
    });
});
