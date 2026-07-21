import {
    GAME_MODE_CODEX,
    getMutatorCatalogRows,
    getRelicCatalogRows,
    RELIC_CATALOG,
    VISUAL_ENDLESS_MODE_LOCKED
} from '../../shared/game-catalog';
import { getRelicBuildArchetypeSummaries } from '../../shared/relics';

type TextTopic = { title: string; description: string };

/** META-005: browse by article guides vs ID tables (rel/relic/mut/ach). */
export type CodexTab = 'all' | 'guides' | 'tables';

type TocKind = 'guide' | 'table';

export const CODEX_TOC: { href: string; label: string; kind: TocKind }[] = [
    { href: '#codex-core', label: 'Core', kind: 'guide' },
    { href: '#codex-powers', label: 'Powers', kind: 'guide' },
    { href: '#codex-scoring', label: 'Scoring', kind: 'guide' },
    { href: '#codex-settings', label: 'Settings', kind: 'guide' },
    { href: '#codex-pickups', label: 'Pickups', kind: 'guide' },
    { href: '#codex-traits', label: 'Traits', kind: 'guide' },
    { href: '#codex-contracts', label: 'Contracts', kind: 'guide' },
    { href: '#codex-featured-runs', label: 'Featured', kind: 'guide' },
    { href: '#codex-builds', label: 'Builds', kind: 'guide' },
    { href: '#codex-modes', label: 'Modes', kind: 'guide' },
    { href: '#codex-achievements', label: 'Achievements', kind: 'table' },
    { href: '#codex-relics', label: 'Relics', kind: 'table' },
    { href: '#codex-mutators', label: 'Mutators', kind: 'table' }
];

export const filterTopics = <T extends TextTopic>(topics: readonly T[], query: string): T[] => {
    const q = query.trim().toLowerCase();
    if (!q) {
        return [...topics];
    }
    return topics.filter(
        (topic) => topic.title.toLowerCase().includes(q) || topic.description.toLowerCase().includes(q)
    );
};

export const codexTabAllows = (tab: CodexTab, kind: TocKind): boolean => {
    if (tab === 'all') {
        return true;
    }
    if (tab === 'guides') {
        return kind === 'guide';
    }
    return kind === 'table';
};

export const tocVisible = (tab: CodexTab, kind: TocKind): boolean => codexTabAllows(tab, kind);

export const hasCodexFilterMatch = ({
    guideCounts,
    tableCounts,
    tab
}: {
    guideCounts: readonly number[];
    tableCounts: readonly number[];
    tab: CodexTab;
}): boolean => {
    const counts = [
        ...(codexTabAllows(tab, 'guide') ? guideCounts : []),
        ...(codexTabAllows(tab, 'table') ? tableCounts : [])
    ];
    return counts.some((count) => count > 0);
};

export const buildCodexBuildRows = () =>
    getRelicBuildArchetypeSummaries().map((row) => ({
        id: row.id,
        title: row.label,
        description: `${row.fantasy} ${row.summary} Decisions: ${row.decisionVerbs.join(', ')}. Relics: ${row.relicIds
            .map((id) => RELIC_CATALOG[id]?.title ?? id)
            .join(', ')}.`
    }));

export const buildCodexRelicRows = () => getRelicCatalogRows();

export const buildCodexMutatorRows = () => getMutatorCatalogRows();

export const buildCodexModeRows = () => [
    ...GAME_MODE_CODEX.map((mode) => ({ id: mode.id, title: mode.title, description: mode.description })),
    {
        id: 'visual_endless_locked',
        title: VISUAL_ENDLESS_MODE_LOCKED.title,
        description: VISUAL_ENDLESS_MODE_LOCKED.description
    }
];
