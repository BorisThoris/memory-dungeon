import { ACHIEVEMENTS } from './achievements';
import { MUTATOR_IDS } from './contracts';
import {
    CODEX_CORE_TOPICS,
    ENCYCLOPEDIA_CONTRACT_TOPICS,
    ENCYCLOPEDIA_FEATURED_RUN_TOPICS,
    ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
    ENCYCLOPEDIA_POWER_TOPICS,
    ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
    ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
    GAME_MODE_CODEX,
    VISUAL_ENDLESS_MODE_LOCKED
} from './mechanics-encyclopedia';
import { RELIC_POOL } from './relics';
import { getTileTraitCodexRows, getTileTraitInteractionCodexRows } from './tile-trait-codex';

export type CodexKnowledgeSectionId =
    | 'guides'
    | 'tables'
    | 'modes'
    | 'achievements'
    | 'relics'
    | 'mutators';

export interface CodexKnowledgeSectionRow {
    id: CodexKnowledgeSectionId;
    title: string;
    entryCount: number;
    description: string;
    deepLink: string;
    localOnly: true;
}

export const getCodexKnowledgeSectionRows = (): CodexKnowledgeSectionRow[] => {
    const guideCount =
        CODEX_CORE_TOPICS.length +
        ENCYCLOPEDIA_POWER_TOPICS.length +
        ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.length +
        ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS.length +
        ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS.length +
        ENCYCLOPEDIA_CONTRACT_TOPICS.length +
        ENCYCLOPEDIA_FEATURED_RUN_TOPICS.length +
        getTileTraitCodexRows().length +
        getTileTraitInteractionCodexRows().length;
    const modeCount = GAME_MODE_CODEX.length + 1;
    const achievementCount = ACHIEVEMENTS.length;
    const relicCount = RELIC_POOL.length;
    const mutatorCount = MUTATOR_IDS.length;
    return [
        {
            id: 'guides',
            title: 'Guide articles',
            entryCount: guideCount,
            description: 'Rules, scoring, powers, pickups, traits, contracts, settings, and featured-run guidance.',
            deepLink: '#codex-core',
            localOnly: true
        },
        {
            id: 'tables',
            title: 'Reference tables',
            entryCount: achievementCount + relicCount + mutatorCount,
            description: 'Stable ID-backed tables for achievements, relics, and mutators.',
            deepLink: '#codex-achievements',
            localOnly: true
        },
        {
            id: 'modes',
            title: 'Mode library',
            entryCount: modeCount,
            description: `Includes live modes plus ${VISUAL_ENDLESS_MODE_LOCKED.title} locked copy.`,
            deepLink: '#codex-modes',
            localOnly: true
        },
        {
            id: 'achievements',
            title: 'Achievements',
            entryCount: achievementCount,
            description: 'Steam/local achievement names and consequences stay aligned with the encyclopedia.',
            deepLink: '#codex-achievements',
            localOnly: true
        },
        {
            id: 'relics',
            title: 'Relics',
            entryCount: relicCount,
            description: 'Run-build modifiers and draft consequences.',
            deepLink: '#codex-relics',
            localOnly: true
        },
        {
            id: 'mutators',
            title: 'Mutators',
            entryCount: mutatorCount,
            description: 'Floor pressure, presentation, and scoring modifiers.',
            deepLink: '#codex-mutators',
            localOnly: true
        }
    ];
};

export interface CodexKnowledgeBaseRow {
    id: 'guide_depth' | 'table_depth' | 'deep_links' | 'filter_recovery';
    title: string;
    count: number;
    action: string;
    localOnly: true;
}

export const getCodexKnowledgeBaseRows = (): CodexKnowledgeBaseRow[] => {
    const sections = getCodexKnowledgeSectionRows();
    const guideCount = sections.find((row) => row.id === 'guides')?.entryCount ?? 0;
    const tableCount = sections.find((row) => row.id === 'tables')?.entryCount ?? 0;
    return [
        {
            id: 'guide_depth',
            title: 'Guide depth',
            count: guideCount,
            action: 'Browse Guides for mechanics, scoring, settings, pickups, contracts, and featured runs.',
            localOnly: true
        },
        {
            id: 'table_depth',
            title: 'Table depth',
            count: tableCount,
            action: 'Use Tables for ID-backed achievements, relics, and mutators.',
            localOnly: true
        },
        {
            id: 'deep_links',
            title: 'Deep links',
            count: sections.filter((row) => row.deepLink.startsWith('#codex-')).length,
            action: 'TOC anchors stay local and never change gameplay state.',
            localOnly: true
        },
        {
            id: 'filter_recovery',
            title: 'Filter recovery',
            count: 1,
            action: 'Clear the filter or switch between Guides and Tables when a search is empty.',
            localOnly: true
        }
    ];
};

export const codexKnowledgeHasLocalOnlyRows = (): boolean =>
    getCodexKnowledgeSectionRows().every((row) => row.localOnly && row.entryCount > 0 && row.deepLink.startsWith('#codex-'));
