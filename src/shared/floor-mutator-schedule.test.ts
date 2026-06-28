import { describe, expect, it } from 'vitest';
import {
    CHAPTER_ACT_BIOME_STRUCTURE,
    ENDLESS_CYCLE_FLOOR_COUNT,
    FLOOR_SCHEDULE_RULES_VERSION,
    getChapterActBiomePresentation,
    getChapterActBiomeForCycleFloor,
    getFloorArchetypeProgressionReport,
    getFloorArchetypeProgressionRows,
    getFloorChapterIdentity,
    pickFloorScheduleEntry,
    usesEndlessFloorSchedule
} from './floor-mutator-schedule';
import { GAME_RULES_VERSION } from './contracts';
import { buildBoard, inspectBoardFairness } from './board-generation';

describe('usesEndlessFloorSchedule', () => {
    it('is false for non-endless modes', () => {
        expect(usesEndlessFloorSchedule('puzzle', FLOOR_SCHEDULE_RULES_VERSION)).toBe(false);
        expect(usesEndlessFloorSchedule('daily', FLOOR_SCHEDULE_RULES_VERSION)).toBe(false);
    });

    it('is false when rules version is below the floor schedule gate', () => {
        expect(usesEndlessFloorSchedule('endless', FLOOR_SCHEDULE_RULES_VERSION - 1)).toBe(false);
    });

    it('is true for endless at or above the gate', () => {
        expect(usesEndlessFloorSchedule('endless', FLOOR_SCHEDULE_RULES_VERSION)).toBe(true);
    });
});

describe('pickFloorScheduleEntry', () => {
    const rv = FLOOR_SCHEDULE_RULES_VERSION;

    it('returns an empty schedule entry for non-endless modes', () => {
        expect(pickFloorScheduleEntry(1, rv, 5, 'puzzle')).toEqual({
            mutators: [],
            floorTag: 'normal',
            floorArchetypeId: null,
            featuredObjectiveId: null,
            cycleFloor: null,
            actId: null,
            actTitle: null,
            actFloorNumber: null,
            actFloorCount: null,
            biomeId: null,
            biomeTitle: null,
            biomeTone: null,
            title: null,
            hint: null,
            theme: null,
            riskProfile: null
        });
    });

    it('returns an empty schedule entry when rules version is below the gate', () => {
        expect(pickFloorScheduleEntry(1, rv - 1, 5, 'endless')).toEqual({
            mutators: [],
            floorTag: 'normal',
            floorArchetypeId: null,
            featuredObjectiveId: null,
            cycleFloor: null,
            actId: null,
            actTitle: null,
            actFloorNumber: null,
            actFloorCount: null,
            biomeId: null,
            biomeTitle: null,
            biomeTone: null,
            title: null,
            hint: null,
            theme: null,
            riskProfile: null
        });
    });

    it('returns authored chapter metadata for endless floors', () => {
        expect(pickFloorScheduleEntry(0, rv, 1, 'endless')).toMatchObject({
            mutators: ['wide_recall'],
            floorTag: 'normal',
            floorArchetypeId: 'survey_hall',
            featuredObjectiveId: 'flip_par',
            title: 'Dungeon Gate',
            theme: 'Gate',
            actTitle: 'Act I — Survey Grounds',
            biomeTitle: 'Lantern Academy',
            actFloorNumber: 1,
            actFloorCount: 4
        });
        expect(pickFloorScheduleEntry(0, rv, 3, 'endless')).toMatchObject({
            mutators: ['findables_floor'],
            floorTag: 'breather',
            floorArchetypeId: 'treasure_gallery',
            featuredObjectiveId: 'scholar_style',
            title: 'Treasure Gallery',
            theme: 'Treasure'
        });
        expect(pickFloorScheduleEntry(0, rv, 7, 'endless')).toMatchObject({
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            featuredObjectiveId: 'glass_witness',
            title: 'Trap Hall',
            theme: 'Trap',
            actTitle: 'Act II — Shadow Archive',
            biomeTitle: 'Shadow Archive'
        });
        expect(pickFloorScheduleEntry(0, rv, 12, 'endless')).toMatchObject({
            mutators: ['shifting_spotlight'],
            floorTag: 'normal',
            floorArchetypeId: 'spotlight_hunt',
            featuredObjectiveId: 'cursed_last',
            title: 'Spotlight Hunt',
            theme: 'Spotlight'
        });
    });

    it('groups scheduled floors into at least three deterministic chapter themes', () => {
        const themes = new Set<string>();
        for (let level = 1; level <= 12; level += 1) {
            const entry = pickFloorScheduleEntry(20260425, rv, level, 'endless');
            const identity = getFloorChapterIdentity(entry);
            expect(identity.mutatorTitles.length).toBe(entry.mutators.length);
            if (identity.chapterTheme) {
                themes.add(identity.chapterTheme);
            }
        }
        expect(themes.size).toBeGreaterThanOrEqual(3);
        expect([...themes]).toEqual(
            expect.arrayContaining(['Gate', 'Treasure', 'Trap', 'Spotlight'])
        );
    });

    it('defines stable three-act biome gates across the twelve-floor cycle', () => {
        expect(ENDLESS_CYCLE_FLOOR_COUNT).toBe(12);
        expect(CHAPTER_ACT_BIOME_STRUCTURE.map((act) => `${act.actTitle}:${act.firstCycleFloor}-${act.lastCycleFloor}`)).toEqual([
            'Act I — Survey Grounds:1-4',
            'Act II — Shadow Archive:5-8',
            'Act III — Spire Convergence:9-12'
        ]);

        expect(getChapterActBiomeForCycleFloor(9)).toMatchObject({
            actId: 'act_3_convergence',
            biomeId: 'spire_convergence',
            actFloorNumber: 1,
            actFloorCount: 4
        });
        expect(getChapterActBiomeForCycleFloor(13)).toMatchObject({
            actId: 'act_1_survey',
            biomeId: 'lantern_academy',
            actFloorNumber: 1
        });
    });

    it('exposes act and biome hooks for UI, palette, audio, and route previews', () => {
        expect(getChapterActBiomePresentation(2)).toMatchObject({
            actId: 'act_1_survey',
            biomeId: 'lantern_academy',
            actProgress: '2/4',
            paletteHook: 'warm_lantern_gold',
            audioHook: 'lantern_study_pulse'
        });
        expect(getChapterActBiomePresentation(7)).toMatchObject({
            actId: 'act_2_shadow',
            biomeId: 'shadow_archive',
            actProgress: '3/4',
            pressureCue: 'Anchor tracking rises into a trap boss before script pressure.'
        });
        expect(getChapterActBiomePresentation(12).routePreview).toContain('spotlight rotation');

        const identity = getFloorChapterIdentity(pickFloorScheduleEntry(0, rv, 9, 'endless'));
        expect(identity).toMatchObject({
            actTitle: 'Act III — Spire Convergence',
            biomeTitle: 'Spire Convergence',
            actProgress: '1/4',
            paletteHook: 'spire_prismatic_alarm',
            audioHook: 'spire_recall_alarm'
        });
        expect(identity.routePreview).toContain('parasite sustain');
    });

    const cycleLen = 12;

    it('wraps level with the endless cycle length', () => {
        const a = pickFloorScheduleEntry(42, rv, 1, 'endless');
        const b = pickFloorScheduleEntry(42, rv, 1 + cycleLen, 'endless');
        expect(b).toEqual(a);
    });

    it('optionally appends distraction_channel on some boss floors without changing archetype or objective', () => {
        let foundWith: number | null = null;
        let foundWithout: number | null = null;
        for (let runSeed = 0; runSeed < 8000; runSeed += 1) {
            const e = pickFloorScheduleEntry(runSeed, rv, 7, 'endless');
            if (e.floorTag !== 'boss') {
                continue;
            }
            if (e.mutators.includes('distraction_channel') && foundWith === null) {
                foundWith = runSeed;
            }
            if (!e.mutators.includes('distraction_channel') && e.mutators.length < 3 && foundWithout === null) {
                foundWithout = runSeed;
            }
            if (foundWith !== null && foundWithout !== null) {
                break;
            }
        }
        expect(foundWith, 'expected a boss seed where distraction_channel appended').not.toBeNull();
        expect(foundWithout, 'expected a boss seed where distraction_channel not appended').not.toBeNull();
        const withDistraction = pickFloorScheduleEntry(foundWith!, rv, 7, 'endless');
        expect(withDistraction.floorArchetypeId).toBe('trap_hall');
        expect(withDistraction.featuredObjectiveId).toBe('glass_witness');
    });

    it('uses the same boss-floor shape for BALANCE_NOTES sim default seed (42001) at level 7', () => {
        const e = pickFloorScheduleEntry(42_001, rv, 7, 'endless');
        expect(e.floorTag).toBe('boss');
        expect(e.floorArchetypeId).toBe('trap_hall');
        expect(e.featuredObjectiveId).toBe('glass_witness');
        expect(e.mutators).toContain('glass_floor');
        expect(e.mutators).toContain('sticky_fingers');
    });

    it('does not add duplicate distraction_channel or exceed three mutators on boss floors', () => {
        for (let runSeed = 0; runSeed < 2000; runSeed += 1) {
            const e = pickFloorScheduleEntry(runSeed, rv, 7, 'endless');
            if (e.floorTag !== 'boss') {
                continue;
            }
            const d = e.mutators.filter((m) => m === 'distraction_channel');
            expect(d.length).toBeLessThanOrEqual(1);
            expect(e.mutators.length).toBeLessThanOrEqual(3);
        }
    });
});

describe('floor archetype progression contract', () => {
    it('assigns a pacing role, route affinity, and budget expectation to every cycle floor', () => {
        const rows = getFloorArchetypeProgressionRows();

        expect(rows).toHaveLength(ENDLESS_CYCLE_FLOOR_COUNT);
        expect(rows.map((row) => row.cycleFloor)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
        expect(rows.map((row) => row.role)).toEqual([
            'baseline',
            'pressure',
            'reward',
            'pressure',
            'pressure',
            'recovery',
            'boss',
            'mystery',
            'boss',
            'reward',
            'pressure',
            'pressure'
        ]);
        for (const row of rows) {
            expect(row.title.length).toBeGreaterThan(0);
            expect(row.mutators.length).toBeGreaterThanOrEqual(0);
            expect(row.budgetExpectation.length).toBeGreaterThan(12);
            expect(row.softlockInvariant).toContain('inspectBoardFairness');
            expect(row.softlockInvariant).toContain('inspectDungeonBoardTopology');
            expect(row.softlockInvariant).toContain('lock');
            expect(row.softlockInvariant).toContain('objective');
            expect(row.actTitle.length).toBeGreaterThan(0);
            expect(row.biomeTitle.length).toBeGreaterThan(0);
        }
    });

    it('keeps representative archetypes distinct for route previews and budgets', () => {
        const rows = getFloorArchetypeProgressionRows();
        const byArchetype = new Map(rows.map((row) => [`${row.floorArchetypeId}:${row.cycleFloor}`, row]));

        expect(byArchetype.get('treasure_gallery:3')).toMatchObject({
            role: 'reward',
            routeAffinity: 'mystery',
            floorTag: 'breather',
            featuredObjectiveId: 'scholar_style'
        });
        expect(byArchetype.get('breather:6')).toMatchObject({
            role: 'recovery',
            routeAffinity: 'safe',
            floorTag: 'breather'
        });
        expect(byArchetype.get('trap_hall:7')).toMatchObject({
            role: 'boss',
            routeAffinity: 'greed',
            floorTag: 'boss',
            featuredObjectiveId: 'glass_witness'
        });
        expect(byArchetype.get('script_room:8')).toMatchObject({
            role: 'mystery',
            routeAffinity: 'mystery',
            featuredObjectiveId: 'flip_par'
        });
    });

    it('reports pressure, recovery, reward, boss, and mystery coverage across 12, 30, and 100 floors', () => {
        for (const floors of [12, 30, 100]) {
            const report = getFloorArchetypeProgressionReport(floors, 12_012, FLOOR_SCHEDULE_RULES_VERSION);
            expect(report.floorsSampled).toBe(floors);
            expect(report.cycleLength).toBe(ENDLESS_CYCLE_FLOOR_COUNT);
            expect(report.rows).toHaveLength(floors);
            expect(report.hasPressure).toBe(true);
            expect(report.hasRecovery).toBe(true);
            expect(report.hasReward).toBe(true);
            expect(report.hasBoss).toBe(true);
            expect(report.hasMystery).toBe(true);
            expect(report.floorTagCounts.normal).toBeGreaterThan(0);
            expect(report.floorTagCounts.breather).toBeGreaterThan(0);
            expect(report.floorTagCounts.boss).toBeGreaterThan(0);
            expect(report.featuredObjectiveCounts.flip_par).toBeGreaterThan(0);
            expect(report.featuredObjectiveCounts.scholar_style).toBeGreaterThan(0);
            expect(report.featuredObjectiveCounts.cursed_last).toBeGreaterThan(0);
        }
    });

    it('keeps one-cycle role counts inside authored frequency bands', () => {
        const report = getFloorArchetypeProgressionReport(ENDLESS_CYCLE_FLOOR_COUNT);

        for (const band of report.frequencyBands) {
            const count = report.roleCounts[band.role];
            expect(count).toBeGreaterThanOrEqual(band.minPerCycle);
            expect(count).toBeLessThanOrEqual(band.maxPerCycle);
        }
        expect(report.archetypeCounts.treasure_gallery).toBe(2);
        expect(report.archetypeCounts.trap_hall).toBe(1);
        expect(report.archetypeCounts.rush_recall).toBe(1);
    });

    it('generates fair boards for each authored archetype row', () => {
        for (const row of getFloorArchetypeProgressionRows()) {
            const board = buildBoard(row.cycleFloor, {
                runSeed: 12_012,
                runRulesVersion: GAME_RULES_VERSION,
                activeMutators: [...row.mutators],
                floorTag: row.floorTag,
                floorArchetypeId: row.floorArchetypeId,
                featuredObjectiveId: row.featuredObjectiveId,
                cycleFloor: row.cycleFloor,
                gameMode: 'endless'
            });
            const fairness = inspectBoardFairness(board);
            expect(fairness.hasCompletionRoute, row.title).toBe(true);
            expect(fairness.issues, row.title).toEqual([]);
        }
    });
});
