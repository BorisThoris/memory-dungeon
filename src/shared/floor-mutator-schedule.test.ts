import { describe, expect, it } from 'vitest';
import {
    endlessActLength,
    endlessPlaceForLevel,
    DESCENT_ACTS,
    DESCENT_FLOOR_COUNT,
    descentActForFloor,
    CHAPTER_ACT_BIOME_STRUCTURE,
    ENDLESS_CYCLE_FLOOR_COUNT,
    FLOOR_SCHEDULE_RULES_VERSION,
    getChapterActBiomePresentation,
    getChapterActBiomeForCycleFloor,
    getFloorArchetypeProgressionReport,
    getFloorArchetypeProgressionRows,
    getFloorChapterIdentity,
    CHAOS_MUTATORS,
    pickFloorScheduleEntry,
    runFollowsFloorSchedule,
    scheduledFloorMutators,
    usesEndlessFloorSchedule,
    WILD_SCHEDULE_RULES_VERSION
} from './floor-mutator-schedule';
import { buildBoard, inspectBoardFairness } from './board-generation';
// These tests name the floors the content was written for: the sixty-floor numbering (`descent-length-rules.ts`).
import { CLASSIC_DESCENT_RULES } from './descent-length-rules';

describe('usesEndlessFloorSchedule', () => {
    it('is false when rules version is below the floor schedule gate', () => {
        expect(usesEndlessFloorSchedule('endless', FLOOR_SCHEDULE_RULES_VERSION - 1)).toBe(false);
    });

    it('is true for endless at or above the gate', () => {
        expect(usesEndlessFloorSchedule('endless', FLOOR_SCHEDULE_RULES_VERSION)).toBe(true);
    });
});

describe('pickFloorScheduleEntry', () => {
    const rv = FLOOR_SCHEDULE_RULES_VERSION;


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
            featuredObjectiveId: 'scholar_style',
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

    it('falls back to the first authored floor for non-finite cycle inputs', () => {
        expect(getChapterActBiomeForCycleFloor(Number.NaN)).toMatchObject({
            actId: 'act_1_survey',
            biomeId: 'lantern_academy',
            actFloorNumber: 1,
            actFloorCount: 4
        });

        expect(pickFloorScheduleEntry(42, rv, Number.NaN, 'endless')).toMatchObject({
            mutators: ['wide_recall'],
            floorTag: 'normal',
            floorArchetypeId: 'survey_hall',
            featuredObjectiveId: 'flip_par',
            cycleFloor: 1
        });
    });

    it('normalizes fractional and negative cycle inputs before resolving chapter metadata', () => {
        expect(getChapterActBiomeForCycleFloor(9.9)).toMatchObject({
            actId: 'act_3_convergence',
            biomeId: 'spire_convergence',
            actFloorNumber: 1
        });
        expect(getChapterActBiomeForCycleFloor(-2)).toMatchObject({
            actId: 'act_1_survey',
            biomeId: 'lantern_academy',
            actFloorNumber: 1
        });

        expect(pickFloorScheduleEntry(42, rv, 7.9, 'endless')).toMatchObject({
            floorTag: 'boss',
            floorArchetypeId: 'trap_hall',
            cycleFloor: 7
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
        expect(identity.routePreview).toContain('a static hall');
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
        expect(withDistraction.featuredObjectiveId).toBe('scholar_style');
    });

    it('uses the same boss-floor shape for BALANCE_NOTES sim default seed (42001) at level 7', () => {
        const e = pickFloorScheduleEntry(42_001, rv, 7, 'endless');
        expect(e.floorTag).toBe('boss');
        expect(e.floorArchetypeId).toBe('trap_hall');
        expect(e.featuredObjectiveId).toBe('scholar_style');
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
            expect(row.softlockInvariant).toContain('completion route');
            expect(row.actTitle.length).toBeGreaterThan(0);
            expect(row.biomeTitle.length).toBeGreaterThan(0);
        }
    });

    it('keeps representative archetypes distinct for route previews and budgets', () => {
        const rows = getFloorArchetypeProgressionRows();
        const byArchetype = new Map(rows.map((row) => [`${row.floorArchetypeId}:${row.cycleFloor}`, row]));

        expect(byArchetype.get('treasure_gallery:3')).toMatchObject({
            role: 'reward',
            floorTag: 'breather',
            featuredObjectiveId: 'scholar_style'
        });
        expect(byArchetype.get('breather:6')).toMatchObject({
            role: 'recovery',
            floorTag: 'breather'
        });
        expect(byArchetype.get('trap_hall:7')).toMatchObject({
            role: 'boss',
            floorTag: 'boss',
            featuredObjectiveId: 'scholar_style'
        });
        expect(byArchetype.get('restless_hall:8')).toMatchObject({
            role: 'mystery',
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

    it('normalizes malformed progression report sample counts', () => {
        expect(getFloorArchetypeProgressionReport(2.9).floorsSampled).toBe(2);
        expect(getFloorArchetypeProgressionReport(-1).floorsSampled).toBe(0);

        const malformed = getFloorArchetypeProgressionReport(Number.NaN);
        expect(malformed.floorsSampled).toBe(ENDLESS_CYCLE_FLOOR_COUNT);
        expect(malformed.rows).toHaveLength(ENDLESS_CYCLE_FLOOR_COUNT);
    });

    it('keeps one-cycle role counts inside authored frequency bands', () => {
        const report = getFloorArchetypeProgressionReport(ENDLESS_CYCLE_FLOOR_COUNT);

        for (const band of report.frequencyBands) {
            const count = report.roleCounts[band.role];
            expect(count).toBeGreaterThanOrEqual(band.minPerCycle);
            expect(count).toBeLessThanOrEqual(band.maxPerCycle);
        }
        // Gen 263: floor 10 is the lantern hall; the cycle keeps two reward floors, one gallery.
        expect(report.archetypeCounts.treasure_gallery).toBe(1);
        expect(report.archetypeCounts.lantern_hall).toBe(1);
        expect(report.archetypeCounts.trap_hall).toBe(1);
        // Floor 9 of the first cycle is the looking-glass hall; the rush recall is the second cycle's.
        expect(report.archetypeCounts.mirror_hall).toBe(1);
        expect(report.archetypeCounts.rush_recall).toBeUndefined();
    });

    it('generates fair boards for each authored archetype row', () => {
        for (const row of getFloorArchetypeProgressionRows()) {
            const board = buildBoard(row.cycleFloor, {
                runSeed: 12_012,
                runRulesVersion: CLASSIC_DESCENT_RULES,
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

describe('warden rotation', () => {
    const scheduleFor = (level: number) =>
        pickFloorScheduleEntry(42001, CLASSIC_DESCENT_RULES, level, 'endless');

    it('meets all four wardens across three cycles', () => {
        const bossFloors = Array.from({ length: ENDLESS_CYCLE_FLOOR_COUNT * 3 }, (_, index) => index + 1)
            .map((level) => ({ level, entry: scheduleFor(level) }))
            .filter(({ entry }) => entry.floorTag === 'boss');

        // The cycle's boss floors do not move - positions 7 and 9 of every twelve - and the
        // Descent adds its act boss on floor 24, the Living Dungeon's last (DGE-002).
        expect(bossFloors.map(({ level }) => level)).toEqual([7, 9, 19, 21, 24, 31, 33]);

        // Position 7 keeps its trap hall - the balance profile leans on that floor's trap
        // budget - while position 9 rotates, so a run that reaches floor 33 has faced every
        // warden the game defines rather than the same two.
        expect(bossFloors.map(({ entry }) => entry.floorArchetypeId)).toEqual([
            'trap_hall',
            'mirror_hall',
            'trap_hall',
            'rush_recall',
            'keeper_hall',
            'trap_hall',
            'treasure_gallery'
        ]);
    });

    it('keeps the cycle\u2019s two boss floors in every twelve to floor 60, and adds each act\u2019s boss on its last floor', () => {
        const actBosses = DESCENT_ACTS.map((act) => act.bossFloor).filter((floor): floor is number => floor != null);
        expect(actBosses).toEqual([24, 40, 60]);
        for (let cycle = 0; cycle < DESCENT_FLOOR_COUNT / ENDLESS_CYCLE_FLOOR_COUNT; cycle += 1) {
            const levels = Array.from({ length: ENDLESS_CYCLE_FLOOR_COUNT }, (_, index) => cycle * ENDLESS_CYCLE_FLOOR_COUNT + index + 1);
            const bosses = levels.filter((level) => scheduleFor(level).floorTag === 'boss');
            const expected = 2 + levels.filter((level) => actBosses.includes(level)).length;
            expect(bosses, `floors ${levels[0]}-${levels.at(-1)}`).toHaveLength(expected);
        }
        for (const floor of actBosses) expect(scheduleFor(floor).floorTag, `floor ${floor}`).toBe('boss');
    });

    it('repeats the four acts past the Warden in Endless cycles, each half as long, each ending on its boss (DGE-006)', () => {
        const lengths = (cycle: number) => DESCENT_ACTS.map((act) => endlessActLength(act, cycle));
        expect(lengths(1)).toEqual([6, 6, 8, 10]);
        expect(lengths(2)).toEqual([4, 4, 4, 5]);
        expect(lengths(5)).toEqual([4, 4, 4, 4]);
        expect(endlessPlaceForLevel(60)).toBeNull();
        expect(endlessPlaceForLevel(61)?.cycle).toBe(1);
        expect(endlessPlaceForLevel(91)?.cycle).toBe(2);
        for (let level = 61; level <= 400; level += 1) {
            const place = endlessPlaceForLevel(level)!;
            expect(descentActForFloor(level).id, `floor ${level}`).toBe(place.act.id);
            if (level === place.firstLevel) expect(place.descentFloor).toBe(place.act.firstFloor);
            if (level === place.lastLevel) {
                expect(place.descentFloor).toBe(place.act.lastFloor);
                if (place.act.bossFloor) expect(scheduleFor(level).floorTag, `floor ${level} is ${place.act.title}'s boss`).toBe('boss');
            }
        }
        // The Warden ends every cycle: floor 90, 107 and every sixteen floors after.
        expect([90, 107, 123, 139].map((level) => scheduleFor(level).floorArchetypeId)).toEqual(['warden_hall', 'warden_hall', 'warden_hall', 'warden_hall']);
    });
});

describe('the Descent (DGE-002)', () => {
    const scheduleFor = (level: number) =>
        pickFloorScheduleEntry(42001, CLASSIC_DESCENT_RULES, level, 'endless');

    it('runs four named acts over floors 1 to 60, with no gap and no overlap', () => {
        expect(DESCENT_ACTS.map((act) => [act.id, act.title, act.firstFloor, act.lastFloor])).toEqual([
            ['gate', 'The Gate', 1, 12],
            ['living_dungeon', 'The Living Dungeon', 13, 24],
            ['deep', 'The Deep', 25, 40],
            ['abyss', 'The Abyss', 41, 60]
        ]);
        for (let level = 1; level <= DESCENT_FLOOR_COUNT; level += 1) {
            const act = descentActForFloor(level);
            expect(level >= act.firstFloor && level <= act.lastFloor, `floor ${level}`).toBe(true);
        }
    });

    it('brings something new every act: a mutator set the act before it never had', () => {
        const setsOf = (act: (typeof DESCENT_ACTS)[number]): Set<string> =>
            new Set(
                Array.from({ length: act.lastFloor - act.firstFloor + 1 }, (_, index) =>
                    [...scheduleFor(act.firstFloor + index).mutators].filter((id) => id !== 'distraction_channel').sort().join('+')
                )
            );
        for (let index = 1; index < DESCENT_ACTS.length; index += 1) {
            const before = setsOf(DESCENT_ACTS[index - 1]!);
            const fresh = [...setsOf(DESCENT_ACTS[index]!)].filter((set) => !before.has(set));
            expect(fresh.length, `${DESCENT_ACTS[index]!.title} brings nothing the act before did not`).toBeGreaterThan(0);
        }
    });
});

describe('a Wild run on the floor schedule', () => {
    it('follows the schedule from rules 65, and an older Wild save keeps its fixed floors', () => {
        expect(WILD_SCHEDULE_RULES_VERSION).toBe(65);
        expect(runFollowsFloorSchedule('endless', 65, true)).toBe(true);
        expect(runFollowsFloorSchedule('endless', 64, true)).toBe(false);
        expect(runFollowsFloorSchedule('endless', 64, false)).toBe(true);
    });

    it('adds the chaos set to a scheduled floor once, and leaves any other run its schedule', () => {
        expect(scheduledFloorMutators(['short_memorize', 'restless_floor'], true)).toEqual([...CHAOS_MUTATORS, 'restless_floor']);
        expect(scheduledFloorMutators(['restless_floor'], false)).toEqual(['restless_floor']);
    });
});
