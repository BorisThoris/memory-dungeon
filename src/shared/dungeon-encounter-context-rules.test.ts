import { describe, expect, it } from 'vitest';

import {
    createDungeonEncounterContext,
    enemyHazardProfileForBoss,
    floorArchetypeForDungeonNode,
    floorTagForDungeonNode
} from './dungeon-encounter-context-rules';

describe('dungeon encounter context rules', () => {
    it('maps node kinds into floor tags', () => {
        expect(floorTagForDungeonNode('boss', 'normal')).toBe('boss');
        expect(floorTagForDungeonNode('rest', 'normal')).toBe('breather');
        expect(floorTagForDungeonNode('shop', 'boss')).toBe('breather');
        expect(floorTagForDungeonNode('combat', 'normal')).toBe('normal');
    });

    it('maps node kinds into floor archetypes', () => {
        expect(floorArchetypeForDungeonNode('treasure', null)).toBe('treasure_gallery');
        expect(floorArchetypeForDungeonNode('trap', null)).toBe('trap_hall');
        expect(floorArchetypeForDungeonNode('event', null)).toBe('script_room');
        expect(floorArchetypeForDungeonNode('elite', null)).toBe('rush_recall');
        expect(floorArchetypeForDungeonNode('rest', null)).toBe('breather');
        expect(floorArchetypeForDungeonNode('combat', 'survey_hall')).toBe('survey_hall');
    });

    it('builds encounter context with pair-count pressure', () => {
        expect(createDungeonEncounterContext('elite', 'normal', null)).toMatchObject({
            nodeKind: 'elite',
            floorTag: 'normal',
            floorArchetypeId: 'rush_recall',
            pairCountDelta: 1
        });
        expect(createDungeonEncounterContext('shop', 'normal', null)).toMatchObject({
            floorTag: 'breather',
            floorArchetypeId: 'breather',
            pairCountDelta: -1
        });
        expect(createDungeonEncounterContext(undefined, 'normal', 'survey_hall')).toMatchObject({
            nodeKind: null,
            floorTag: 'normal',
            floorArchetypeId: 'survey_hall',
            pairCountDelta: 0
        });
    });

    it('derives boss hazard profiles and falls back to rush sentinel', () => {
        expect(enemyHazardProfileForBoss('trap_warden')).toMatchObject({
            kind: 'warden',
            pattern: 'guard'
        });
        expect(enemyHazardProfileForBoss(null)).toMatchObject({
            kind: 'sentinel',
            pattern: 'patrol'
        });
    });
});
