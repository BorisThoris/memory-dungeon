import { describe, expect, it } from 'vitest';
import {
    FEATURED_OBJECTIVE_STREAK_BONUS_MAX,
    FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP,
    MUTATOR_IDS,
    type AchievementId,
    type GameMode,
    type MutatorId
} from './contracts';
import { getDefaultDifficultyProfile } from './difficulty-profile';
import { FEATURED_OBJECTIVE_LABELS } from './floor-mutator-schedule';
import { PAR_TURNS_PER_PAIR } from './floor-par';
import {
    MISS_BANK_CAP,
    MISS_BANK_COMBO_RUNG,
    MISS_BANK_FLOOR_GRANT,
    MISS_BANK_LIFETIME_FLOORS,
    MISS_BANK_OPENING
} from './miss-bank';
import { DEEP_POCKETS_CAP } from './run-relic-rules';
import { getFeaturedObjectiveBonusScore } from './secondary-objective-rules';
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
    glossaryTermById,
    MUTATOR_CATALOG
} from './mechanics-encyclopedia';

const TOPIC_ID = /^[a-z][a-z0-9_]*$/;

const ALL_GAME_MODES: GameMode[] = ['endless'];

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
        expect(MECHANICS_GLOSSARY.every((row) => row.shortDefinition.length > 0)).toBe(true);
        expect(glossaryTermById('missing_term' as Parameters<typeof glossaryTermById>[0]).id).toBe('mutators');
    });

    it('REG-101 glossary avoids forbidden monetization and internal labels', () => {
        expect(MECHANICS_GLOSSARY.every((row) => row.avoidLabels.length > 0)).toBe(true);
        expect(MECHANICS_GLOSSARY.flatMap((row) => row.avoidLabels)).not.toContain('shop currency');
    });

    it('names no system the dungeon layer took with it', () => {
        // The relic draft, shop gold, routes, side rooms, wagers, wardens, keys and exits are gone
        // from the rules, so no reference copy may still describe them as if a player could meet
        // them. Relics themselves came back on 2026-09-24, bought in the store rather than drafted
        // (`run-relic-rules.ts`), so the guard names the draft and not the word.
        const removed = /relic draft|relic offer|relic pick|draft a relic|shop gold|route card|side room|wager|warden|dungeon key|locked exit/i;
        for (const term of MECHANICS_GLOSSARY) {
            expect(term.shortDefinition, term.id).not.toMatch(removed);
            expect(term.preferredLabel, term.id).not.toMatch(removed);
        }
        const topics = [
            ...CODEX_CORE_TOPICS,
            ...ENCYCLOPEDIA_POWER_TOPICS,
            ...ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
            ...ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
            ...ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
            ...ENCYCLOPEDIA_CONTRACT_TOPICS,
            ...ENCYCLOPEDIA_FEATURED_RUN_TOPICS,
            ...GAME_MODE_CODEX,
            ...Object.values(MUTATOR_CATALOG),
            ...Object.values(ACHIEVEMENT_CATALOG)
        ];
        for (const topic of topics) {
            expect(topic.description, topic.id).not.toMatch(removed);
            expect(topic.title, topic.id).not.toMatch(removed);
        }
    });

    it('names no part of the life economy Gen 183 removed', () => {
        // Lives, guard tokens, the first-mismatch grace, chain heal, the shard-to-life conversion and (Gen 184) the shard itself,
        // the clear-life bonus and the score parasite are gone from the rules (docs/REMOVED_LIVES.md).
        // No reference copy may describe them as if a player could still meet them; the glossary
        // has no term for them and the sections have no entry for them.
        const removed = /\blives\b|\blife\b|guard token|parasite|mismatch grace|chain heal|one heart/i;
        const glossaryIds = MECHANICS_GLOSSARY.map((term) => term.id);
        expect(glossaryIds).not.toContain('lives');
        expect(glossaryIds).not.toContain('guard_tokens');
        for (const term of MECHANICS_GLOSSARY) {
            expect(term.shortDefinition, term.id).not.toMatch(removed);
            expect(term.preferredLabel, term.id).not.toMatch(removed);
        }
        const topics = [
            ...CODEX_CORE_TOPICS,
            ...ENCYCLOPEDIA_POWER_TOPICS,
            ...ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS,
            ...ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS,
            ...ENCYCLOPEDIA_SETTINGS_AND_ASSISTS_TOPICS,
            ...ENCYCLOPEDIA_CONTRACT_TOPICS,
            ...ENCYCLOPEDIA_FEATURED_RUN_TOPICS,
            ...GAME_MODE_CODEX,
            ...Object.values(MUTATOR_CATALOG),
            ...Object.values(ACHIEVEMENT_CATALOG)
        ];
        const topicIds = topics.map((topic) => topic.id);
        for (const gone of ['lives', 'sys_chain_heal_and_guard', 'sys_clear_life_bonus', 'score_parasite']) {
            expect(topicIds).not.toContain(gone);
        }
        for (const topic of topics) {
            expect(topic.description, topic.id).not.toMatch(removed);
            expect(topic.title, topic.id).not.toMatch(removed);
        }
    });

    it('describes how a run ends by the turn ceiling, and re-reads ACH_LAST_LIFE against it', () => {
        // Thesis §42.2: a run ends when the player stops or a floor is not cleared within three
        // times its par. The Steam API name ACH_LAST_LIFE stays; the achievement it names is now
        // clearing a floor on the ceiling's final turn.
        const ceiling = CODEX_CORE_TOPICS.find((topic) => topic.id === 'miss_budget');
        expect(ceiling?.title).toBe('Misses');
        expect(ceiling?.description).toContain('**misses**');
        expect(ceiling?.description).toContain('ends the run');
        expect(ceiling?.description).toContain('when you stop');
        expect(ACHIEVEMENT_CATALOG.ACH_LAST_LIFE.title).toBe('Last Turn Standing');
        expect(ACHIEVEMENT_CATALOG.ACH_LAST_LIFE.description).toBe(
            'Clear a floor with your last miss already spent.'
        );
        expect(MUTATOR_CATALOG.magpie_thief.description).not.toMatch(/scare/i);
    });

    it('states the miss bank the rules actually run, not the one it replaced', () => {
        /*
         * The Codex said "opens with two, one back every floor, never more than three" for days
         * after the bank became earned grants with a shelf life (3 to open, +1 a floor clear, +1 a
         * fifth chain link, three floors each, cap 4). Found reading the Codex after a deep playtest.
         */
        const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];
        const bank = CODEX_CORE_TOPICS.find((topic) => topic.id === 'miss_budget')!.description;
        expect(bank).toContain(`opens with **${words[MISS_BANK_OPENING]}**`);
        expect(bank).toContain(`clearing a floor earns **${words[MISS_BANK_FLOOR_GRANT]}**`);
        expect(bank).toContain(`every **fifth match in a row**`);
        expect(MISS_BANK_COMBO_RUNG).toBe(5);
        expect(bank).toContain(`lasts **${words[MISS_BANK_LIFETIME_FLOORS]} floors**`);
        expect(bank).toContain(`holds **${words[MISS_BANK_CAP]}** at most (**${words[DEEP_POCKETS_CAP]}** with Deep Pockets)`);
        const profile = getDefaultDifficultyProfile().playerCopy;
        expect(profile).toContain(`opens with ${words[MISS_BANK_OPENING]}`);
        expect(profile).toContain(`never holds more than ${words[MISS_BANK_CAP]}`);
    });

    it('ACHIEVEMENT_CATALOG has an entry per AchievementId with id/title/description aligned to keys', () => {
        for (const id of Object.keys(ACHIEVEMENT_CATALOG) as AchievementId[]) {
            assertCatalogEntry(id, ACHIEVEMENT_CATALOG[id]);
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

    it('describes the floor schedule by the objective and streak rules that exist', () => {
        const schedule = ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS.find(
            (topic) => topic.id === 'sys_floor_schedule_and_featured_objective'
        );
        expect(schedule?.description).toContain('featured objective');
        expect(schedule?.description).toContain('objective streak');
        expect(ENCYCLOPEDIA_PICKUP_AND_BOARD_TOPICS.find((topic) => topic.id === 'pickup_findables')?.description)
            .toContain('one kind');
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

describe('featured objectives and par, as the rules pay them', () => {
    /*
     * Found by the test hall's featured-streak room: the objective topics quoted +40 / +30 / +50
     * against the 50 / 45 / 65 a clear pays, named a fourth objective (Glass witness) that went in
     * Gen 196, and gave par as `ceil(pairs × 0.85)`, a rate floor-par.ts retired in Gen 181.
     */
    const topic = (id: string): string =>
        [...CODEX_CORE_TOPICS, ...ENCYCLOPEDIA_SCORING_AND_SURVIVAL_TOPICS].find((entry) => entry.id === id)?.description ?? '';

    it('quotes the bonus each objective pays', () => {
        for (const [id, objective] of [
            ['sys_scholar_style_floor', 'scholar_style'],
            ['sys_flip_par_floor', 'flip_par'],
            ['sys_cursed_last', 'cursed_last']
        ] as const) {
            expect(topic(id), id).toContain(`+${getFeaturedObjectiveBonusScore(objective)}**`);
        }
    });

    it('names exactly the featured objectives the schedule deals', () => {
        const text = topic('sys_floor_schedule_and_featured_objective');
        for (const label of Object.values(FEATURED_OBJECTIVE_LABELS)) {
            expect(text).toContain(`**${label}**`);
        }
        expect(text).not.toContain('Glass witness');
        expect(text).toContain(`+${FEATURED_OBJECTIVE_STREAK_BONUS_PER_STEP}**`);
        expect(text).toContain(`+${FEATURED_OBJECTIVE_STREAK_BONUS_MAX}**`);
    });

    it('never quotes the retired par rate', () => {
        for (const id of ['scoring', 'sys_flip_par_floor']) {
            expect(topic(id), id).not.toContain('0.85');
        }
        expect(topic('scoring')).toContain(`${PAR_TURNS_PER_PAIR} turns a pair`);
    });

    it('describes sticky fingers as a face-down card that sticks', () => {
        expect(MUTATOR_CATALOG.sticky_fingers.description).toContain('face-down card touching');
    });
});
