import { describe, expect, it } from 'vitest';
import {
    getBossEncounterIdentityForFloor,
    getEncounterIdentityForFloor,
    getEncounterIdentityForRouteKind,
    getFloorIdentityContract
} from './boss-encounters';
import { GAME_RULES_VERSION } from './contracts';
import { pickFloorScheduleEntry } from './floor-mutator-schedule';

describe('REG-076 boss and elite encounter identity', () => {
    it('derives boss identity from scheduled boss floor tags', () => {
        const entry = pickFloorScheduleEntry(76_001, GAME_RULES_VERSION, 7, 'endless');
        const identity = getEncounterIdentityForFloor(entry);
        const floorIdentity = getBossEncounterIdentityForFloor(entry.floorTag, entry)!;

        expect(identity).not.toBeNull();
        expect(identity).toMatchObject({
            encounterRank: 'boss',
            label: 'Boss encounter',
            scoreRule: 'Applies the boss floor score multiplier after bonuses.'
        });
        expect(identity!.mechanics.length).toBeGreaterThanOrEqual(2);
        expect(identity!.mechanics.join(' ')).toContain('Keystone Warden');
        expect(identity!.mechanics).toEqual(expect.arrayContaining([expect.stringContaining('Keystone Pair')]));
        expect(identity!.placeholderNeeded).toBe(true);
        expect(identity!.placeholderSlots).toContain('boss intro stinger');
        expect(floorIdentity.payoffCopy).toContain('Offline-safe fallback art and audio');
        expect(floorIdentity.payoffCopy).not.toMatch(/placeholder/i);
    });

    it('names elite route identity without claiming boss score rules', () => {
        const identity = getEncounterIdentityForRouteKind('elite');

        expect(identity).not.toBeNull();
        expect(identity!.encounterRank).toBe('elite');
        expect(identity!.label).toBe('Mnemonic Sentinel');
        expect(identity!.scoreRule).toBe('No boss score multiplier; elite identity is route-pressure and reward pacing only.');
        expect(identity!.mechanics.join(' ')).toContain('Elite Cache');
        expect(identity!.mechanics.join(' ')).toContain('Final Ward');
        expect(identity!.mechanics.join(' ')).toContain('Omen Seal');
        expect(identity!.placeholderSlots).toContain('elite route badge');
    });

    it('keeps normal/breather floors out of boss encounter presentation', () => {
        const entry = pickFloorScheduleEntry(76_001, GAME_RULES_VERSION, 1, 'endless');

        expect(getEncounterIdentityForFloor(entry)).toBeNull();
        expect(getEncounterIdentityForRouteKind('combat')).toBeNull();
    });

    it('provides floor identity contracts for baseline, trap, recovery, treasure, parasite, and boss floors', () => {
        const rows = [
            getFloorIdentityContract({
                floorTag: 'normal',
                floorArchetypeId: 'survey_hall',
                mutators: [],
                featuredObjectiveLabel: 'Flip par'
            }),
            getFloorIdentityContract({
                floorTag: 'boss',
                floorArchetypeId: 'trap_hall',
                mutators: ['glass_floor', 'sticky_fingers'],
                featuredObjectiveLabel: 'Glass witness'
            }),
            getFloorIdentityContract({
                floorTag: 'breather',
                floorArchetypeId: 'breather',
                mutators: [],
                featuredObjectiveLabel: 'Scholar style'
            }),
            getFloorIdentityContract({
                floorTag: 'breather',
                floorArchetypeId: 'treasure_gallery',
                mutators: ['findables_floor'],
                featuredObjectiveLabel: 'Scholar style'
            }),
            getFloorIdentityContract({
                floorTag: 'normal',
                floorArchetypeId: 'parasite_tithe',
                mutators: ['score_parasite'],
                featuredObjectiveLabel: 'Scholar style'
            })
        ];

        expect(rows.map((row) => row.id)).toEqual([
            'baseline_floor',
            'boss_trophy_moment',
            'recovery_study_room',
            'locked_gallery_late',
            'parasite_tithe'
        ]);
        expect(rows[1]).toMatchObject({
            label: 'Keystone chamber',
            activeReminder: 'Keystone Warden: finish the boss objective before leaving.'
        });
        for (const row of rows) {
            expect(row.teachingSentence.length).toBeGreaterThan(20);
            expect(row.counterplaySentence.length).toBeGreaterThan(20);
            expect(row.floorClearSentence.length).toBeGreaterThan(20);
            expect(row.atmosphericFeedback.length).toBeGreaterThan(20);
            expect(row.atmosphericFeedback).not.toBe(row.floorClearSentence);
            expect(row.activeReminder.length).toBeGreaterThan(10);
            expect(row.tokens.length).toBeGreaterThan(0);
        }
    });
});
