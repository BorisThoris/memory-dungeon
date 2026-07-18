import { describe, expect, it } from 'vitest';
import { MUTATOR_IDS, type AchievementId, type GameMode, type MutatorId, type RelicId } from './contracts';
import {
    ACHIEVEMENT_CATALOG,
    CODEX_CORE_TOPICS,
    ENCYCLOPEDIA_CONTRACT_TOPICS,
    ENCYCLOPEDIA_FEATURED_RUN_TOPICS,
    MECHANICS_GLOSSARY,
    ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
    ENCYCLOPEDIA_POWER_TOPICS,
    ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
    ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
    ENCYCLOPEDIA_VERSION,
    GAME_MODE_CODEX,
    MUTATOR_CATALOG,
    RELIC_CATALOG
} from './mechanics-encyclopedia';

const TOPIC_ID = /^[a-z][a-z0-9_]*$/;

const ALL_GAME_MODES: GameMode[] = ['endless', 'daily', 'puzzle', 'gauntlet', 'meditation'];

function assertCatalogEntry<T extends { id: string; title: string; description: string }>(
    key: string,
    entry: T
): void {
    expect(entry.id, `${key}: id field`).toBe(key);
    expect(entry.title.trim().length, `${key}: title`).toBeGreaterThan(0);
    expect(entry.description.trim().length, `${key}: description`).toBeGreaterThan(0);
}

describe('mechanics-encyclopedia', () => {
    it('ENCYCLOPEDIA_VERSION is monotonic (bump when doc set changes)', () => {
        expect(ENCYCLOPEDIA_VERSION).toBeGreaterThanOrEqual(14);
    });

    it('REG-064 glossary locks preferred player-facing labels for recurring mechanics', () => {
        expect(MECHANICS_GLOSSARY.find((row) => row.id === 'perfect_memory')?.preferredLabel).toBe('Perfect Memory');
        expect(MECHANICS_GLOSSARY.find((row) => row.id === 'recall_focus')?.preferredLabel).toBe('Recall Focus');
        expect(MECHANICS_GLOSSARY.find((row) => row.id === 'shop_gold')?.preferredLabel).toBe('shop gold');
        expect(MECHANICS_GLOSSARY.find((row) => row.id === 'combo_shards')?.avoidLabels).toContain('paid shards');
        expect(MECHANICS_GLOSSARY.every((row) => row.shortDefinition.length > 0)).toBe(true);
    });

    it('REG-101 glossary avoids forbidden monetization and internal labels', () => {
        expect(MECHANICS_GLOSSARY.every((row) => row.avoidLabels.length > 0)).toBe(true);
        expect(MECHANICS_GLOSSARY.flatMap((row) => row.avoidLabels)).not.toContain('shop currency');
        expect(MECHANICS_GLOSSARY.find((row) => row.id === 'shop_gold')?.avoidLabels).toContain('premium gold');
    });

    it('DNG-064 covers shipped dungeon terms in the glossary and Codex board guide', () => {
        const requiredDungeonTerms = [
            'dungeon_enemies',
            'enemy_patrols',
            'trap_cards',
            'dungeon_keys',
            'locked_exits',
            'dungeon_rooms',
            'rest_shrines',
            'treasure_caches',
            'route_cards',
            'boss_floors',
            'elite_anchors',
            'dungeon_objectives'
        ];

        for (const id of requiredDungeonTerms) {
            const row = MECHANICS_GLOSSARY.find((term) => term.id === id);
            expect(row?.shortDefinition.length, id).toBeGreaterThan(20);
            expect(row?.surfaces.length, id).toBeGreaterThanOrEqual(2);
        }

        const guide = ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.find((topic) => topic.id === 'board_dungeon_glossary');
        expect(guide?.description).toContain('enemy patrols');
        expect(guide?.description).toContain('locked exits');
        expect(guide?.description).toContain('dungeon objectives');
    });

    it('ACHIEVEMENT_CATALOG has an entry per AchievementId with id/title/description aligned to keys', () => {
        for (const id of Object.keys(ACHIEVEMENT_CATALOG) as AchievementId[]) {
            assertCatalogEntry(id, ACHIEVEMENT_CATALOG[id]);
        }
    });

    it('RELIC_CATALOG has an entry per RelicId with id/title/description aligned to keys', () => {
        for (const id of Object.keys(RELIC_CATALOG) as RelicId[]) {
            assertCatalogEntry(id, RELIC_CATALOG[id]);
        }
    });

    it('MUTATOR_CATALOG has an entry per MutatorId with id/title/description aligned to keys', () => {
        expect(Object.keys(MUTATOR_CATALOG).sort()).toEqual([...MUTATOR_IDS].sort());
        for (const id of Object.keys(MUTATOR_CATALOG) as MutatorId[]) {
            assertCatalogEntry(id, MUTATOR_CATALOG[id]);
        }
    });

    it('GAME_MODE_CODEX lists every GameMode exactly once', () => {
        const ids = GAME_MODE_CODEX.map((m) => m.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(GAME_MODE_CODEX.length).toBe(ALL_GAME_MODES.length);
        for (const mode of ALL_GAME_MODES) {
            expect(ids).toContain(mode);
        }
        for (const m of GAME_MODE_CODEX) {
            assertCatalogEntry(m.id, { id: m.id, title: m.title, description: m.description });
        }
    });

    it('topic ids are unique across core + granular encyclopedia sections', () => {
        const all = [
            ...CODEX_CORE_TOPICS,
            ...ENCYCLOPEDIA_POWER_TOPICS,
            ...ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
            ...ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
            ...ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
            ...ENCYCLOPEDIA_CONTRACT_TOPICS,
            ...ENCYCLOPEDIA_FEATURED_RUN_TOPICS
        ];
        const ids = all.map((t) => t.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it('encyclopedia topic ids are stable slugs (anchors / cross-refs)', () => {
        const all = [
            ...CODEX_CORE_TOPICS,
            ...ENCYCLOPEDIA_POWER_TOPICS,
            ...ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
            ...ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
            ...ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
            ...ENCYCLOPEDIA_CONTRACT_TOPICS,
            ...ENCYCLOPEDIA_FEATURED_RUN_TOPICS
        ];
        for (const t of all) {
            expect(t.id, t.title).toMatch(TOPIC_ID);
        }
    });

    it('documents route-world cards, anchors, reveal rules, and side rooms', () => {
        expect(CODEX_CORE_TOPICS.find((topic) => topic.id === 'route_world')?.description).toContain(
            'route-specific card families'
        );
        expect(ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.find((topic) => topic.id === 'board_route_cards')?.description)
            .toContain('Safe Ward');
        expect(ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.find((topic) => topic.id === 'board_route_reveal')?.description)
            .toContain('Omen Seal');
        expect(
            ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.find((topic) => topic.id === 'board_boss_elite_anchors')
                ?.description
        ).toContain('Elite Cache');
        expect(
            ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.find((topic) => topic.id === 'board_route_side_rooms')?.description
        ).toContain('relic weighting');
    });

    it('keeps Codex coverage for power scope, assists, and presentation mutators', () => {
        expect(ENCYCLOPEDIA_POWER_TOPICS.find((topic) => topic.id === 'power_flash_pair')?.description).toContain(
            'practice'
        );
        expect(ENCYCLOPEDIA_POWER_TOPICS.find((topic) => topic.id === 'power_gambit')?.description).toContain(
            'perfect clear'
        );
        expect(
            ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS.find((topic) => topic.id === 'assist_pair_proximity')
                ?.description
        ).toContain('distance-class');
        expect(MUTATOR_CATALOG.wide_recall.description).toContain('scores slightly less');
        expect(MUTATOR_CATALOG.silhouette_twist.description).toContain('scores slightly less');
        expect(MUTATOR_CATALOG.distraction_channel.description).toContain('scores slightly less');
        expect(ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS.find((topic) => topic.id === 'sys_recall_focus')?.description)
            .toContain('forgotten markers are removed');
    });
});
