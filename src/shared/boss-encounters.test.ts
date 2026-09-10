import { describe, expect, it } from 'vitest';
import {
    getBossEncounterIdentityForFloor,
    getEncounterIdentityForFloor,
    getFloorIdentityContract
} from './boss-encounters';
import { FLOOR_ARCHETYPE_IDS, GAME_RULES_VERSION, type MutatorId } from './contracts';
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


    it('keeps normal/breather floors out of boss encounter presentation', () => {
        const entry = pickFloorScheduleEntry(76_001, GAME_RULES_VERSION, 1, 'endless');

        expect(getEncounterIdentityForFloor(entry)).toBeNull();
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
                mutators: ['sticky_fingers'],
                featuredObjectiveLabel: 'Scholar style'
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
                mutators: ['distraction_channel'],
                featuredObjectiveLabel: 'Scholar style'
            })
        ];

        expect(rows.map((row) => row.id)).toEqual([
            'baseline_floor',
            'boss_trophy_moment',
            'recovery_study_room',
            'pickup_gallery_dense',
            'anchor_floor'
        ]);
        expect(rows[1]).toMatchObject({
            label: 'Keystone chamber',
            activeReminder: 'Keystone: two suits, long chains.'
        });
        /*
         * Gen 201: these sentences are read in a run, so they have to describe the run. The whole
         * table used to teach traps, disarms, keys, locks, guard, the parasite clock and finding
         * the exit - every one of them removed with the dungeon layer. The check below is the one
         * that would have caught it: no floor may coach a noun the game does not have.
         */
        const removedNouns = /\b(trap|disarm|key|keys|lock|locked|guard|parasite|exit|cache|relic|gold|shop|life|lives|destroy|stray|favor)\b/i;
        /*
         * Over EVERY floor the schedule can produce, not the five sampled above: eleven archetypes
         * times three tags, plus the null-archetype fallback, each with and without a mutator that
         * changes the branch taken. The five-row sample is what let the old table rot in the first
         * place - four of its seven branches were never looked at.
         */
        const everyFloor = FLOOR_ARCHETYPE_IDS.flatMap((floorArchetypeId) =>
            (['normal', 'breather', 'boss'] as const).flatMap((floorTag) =>
                [[], ['findables_floor'], ['short_memorize']].map((mutators) =>
                    getFloorIdentityContract({
                        floorTag,
                        floorArchetypeId,
                        mutators: mutators as MutatorId[],
                        featuredObjectiveLabel: null
                    })
                )
            )
        ).concat(
            getFloorIdentityContract({ floorTag: 'normal', floorArchetypeId: null, mutators: [], featuredObjectiveLabel: null })
        );
        expect(everyFloor.length).toBe(100);
        for (const row of [...rows, ...everyFloor]) {
            for (const sentence of [row.teachingSentence, row.counterplaySentence, row.floorClearSentence, row.activeReminder]) {
                expect(sentence, `${row.id} coaches a removed system: ${sentence}`).not.toMatch(removedNouns);
            }
            expect(row.teachingSentence.length).toBeGreaterThan(20);
            expect(row.counterplaySentence.length).toBeGreaterThan(20);
            expect(row.activeReminder.length).toBeGreaterThan(10);
        }
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
