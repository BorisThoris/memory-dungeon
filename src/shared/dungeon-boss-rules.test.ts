import { describe, expect, it } from 'vitest';

import {
    DUNGEON_BOSS_DEFEAT_SCORE,
    DUNGEON_BOSS_DEFINITIONS,
    DUNGEON_ELITE_ENCOUNTER_RULES,
    getDungeonBossDefinition,
    getDungeonEliteEncounterRules
} from './dungeon-boss-rules';

describe('dungeon boss rules', () => {
    it('defines every boss with a stable lookup', () => {
        expect(Object.keys(DUNGEON_BOSS_DEFINITIONS).sort()).toEqual([
            'rush_sentinel',
            'spire_observer',
            'trap_warden',
            'treasure_keeper'
        ]);

        for (const definition of Object.values(DUNGEON_BOSS_DEFINITIONS)) {
            expect(getDungeonBossDefinition(definition.id)).toBe(definition);
            expect(definition.hp).toBeGreaterThan(0);
            expect(definition.reward.score).toBeGreaterThanOrEqual(DUNGEON_BOSS_DEFEAT_SCORE);
            expect(definition.visualAudioPlaceholders.length).toBeGreaterThan(0);
        }
    });

    it('returns null for missing boss ids', () => {
        expect(getDungeonBossDefinition(null)).toBeNull();
        expect(getDungeonBossDefinition(undefined)).toBeNull();
    });

    it('keeps the rush sentinel combo-shard reward distinct from baseline boss rewards', () => {
        expect(DUNGEON_BOSS_DEFINITIONS.rush_sentinel.reward).toMatchObject({
            score: DUNGEON_BOSS_DEFEAT_SCORE + 10,
            comboShards: 1,
            relicFavor: 1
        });
    });

    it('exposes elite encounter rules only for elite route nodes', () => {
        expect(getDungeonEliteEncounterRules('elite')).toBe(DUNGEON_ELITE_ENCOUNTER_RULES);
        expect(getDungeonEliteEncounterRules('boss')).toBeNull();
        expect(getDungeonEliteEncounterRules(null)).toBeNull();
        expect(DUNGEON_ELITE_ENCOUNTER_RULES).toMatchObject({
            objectiveId: 'pacify_floor',
            threatBudgetFloor: 2,
            rewardBudgetFloor: 1,
            movingPatrolFloor: 1
        });
    });
});
