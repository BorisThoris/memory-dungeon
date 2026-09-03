import type {
    FeaturedObjectiveId,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    MutatorId,
    RouteNodeType
} from './contracts';
import { createMulberry32, hashStringToSeed } from './rng';
import { runNonNegativeIntegerWithFallback } from './run-number-guards';

/**
 * Rules version that introduced authored endless chapters with featured objectives.
 *
 * **Bump checklist (do all before merging):**
 * 1. Increment this constant; note `GAME_RULES_VERSION` / save compatibility if players see different floors.
 * 2. Extend `floor-mutator-schedule.test.ts` for new cycle entries (ref: docs/refinement-tasks REF-003).
 * 3. Cross-link: [GAMEPLAY_POLISH_AND_GAPS.md](../../docs/gameplay/GAMEPLAY_POLISH_AND_GAPS.md), internal wiki
 *    [SOURCE_MAP.md](../../docs/internal-wiki/SOURCE_MAP.md) if schedule behavior is summarized there.
 * 4. Player-facing changelog: mention whether endless uses the scripted floor schedule (`usesEndlessFloorSchedule`).
 */
export const FLOOR_SCHEDULE_RULES_VERSION = 4;

export interface FloorArchetypeDefinition {
    title: string;
    hint: string;
    /** REG-020: short player-facing chapter band for pre-floor telegraphing. */
    theme: string;
    /** REG-020: action-oriented risk note shown before/during a floor. */
    riskProfile: string;
    /** REG-076: encounter identity hook for boss/elite presentation rows. */
    encounterRole?: 'boss' | 'elite';
}

export const FLOOR_ARCHETYPE_CATALOG: Record<FloorArchetypeId, FloorArchetypeDefinition> = {
    survey_hall: {
        title: 'Dungeon Gate',
        hint: 'First room shows the dungeon route, exit pressure, and patrol intel before the descent branches.',
        theme: 'Gate',
        riskProfile: 'Readable opener with dungeon route intel; clear fast to choose the next room.'
    },
    speed_trial: {
        title: 'Speed Trial',
        hint: 'The study window is short. Clear with confidence.',
        theme: 'Speed',
        riskProfile: 'Short memorize; commit quickly after the reveal.'
    },
    treasure_gallery: {
        title: 'Treasure Gallery',
        hint: 'Pickup pairs are dense here. Clean play keeps Scholar style alive.',
        theme: 'Treasure',
        riskProfile: 'Pickup-rich breather; avoid destroy if you want rewards.'
    },
    shadow_read: {
        title: 'Shadow Read',
        hint: 'Silhouettes hide detail. Leave the cursed pair for last.',
        theme: 'Shadow',
        riskProfile: 'Silhouette pressure; identify the cursed pair before clearing.'
    },
    anchor_chain: {
        title: 'Anchor Chain',
        hint: 'Track the anchor cadence and preserve the cursed-last line.',
        theme: 'Anchor',
        riskProfile: 'N-back anchor cadence; use pins/peek only when needed.'
    },
    trap_hall: {
        title: 'Trap Hall',
        hint: 'A glass decoy stalks the board. Keep it out of every miss.',
        theme: 'Trap',
        riskProfile: 'Glass decoy plus sticky pressure; do not drag the trap into a miss.',
        encounterRole: 'boss'
    },
    script_room: {
        title: 'Script Room',
        hint: 'Letters replace the usual read. Finish within par.',
        theme: 'Script',
        riskProfile: 'Letter-symbol read; lean on shape/category memory.'
    },
    rush_recall: {
        title: 'Rush Recall',
        hint: 'Short study and wide recall collide. Boss floors reward sharp clears.',
        theme: 'Rush',
        riskProfile: 'Boss pressure with short study and wider recall.',
        encounterRole: 'boss'
    },
    parasite_tithe: {
        title: 'Parasite Tithe',
        hint: 'The parasite taxes slow descents. Play clean and bank favor.',
        theme: 'Parasite',
        riskProfile: 'Parasite clock; sustain relics and guard tokens matter.'
    },
    spotlight_hunt: {
        title: 'Spotlight Hunt',
        hint: 'Ward and bounty drift after every turn. Save the cursed pair for last.',
        theme: 'Spotlight',
        riskProfile: 'Ward/bounty rotation; re-evaluate targets after each resolve.'
    },
    breather: {
        title: 'Breather',
        hint: 'A calmer floor to steady the board and bank favor.',
        theme: 'Breather',
        riskProfile: 'Lower pressure; rebuild resources and protect streaks.'
    }
};

export const FEATURED_OBJECTIVE_LABELS: Record<FeaturedObjectiveId, string> = {
    scholar_style: 'Scholar style',
    glass_witness: 'Glass witness',
    cursed_last: 'Cursed last',
    flip_par: 'Flip par'
};

/** Endless objective pill `title` — align with `isFeaturedObjectiveCompleted` in `game.ts`. */
export const FEATURED_OBJECTIVE_HUD_TOOLTIPS: Record<FeaturedObjectiveId, string> = {
    flip_par:
        'Match resolutions (pair clears, including gambit) this floor must stay at or below ceil(pairCount × 1.25) + 2. Not the same as every tile flip.',
    scholar_style: 'Do not use board shuffle, tile swap, or destroy pair on this floor.',
    glass_witness: 'With a glass decoy, it must never be flipped into a mismatch.',
    cursed_last: 'The cursed pair must be the last real pair you clear on this floor (not resolved early).'
};

export const getFeaturedObjectiveHudTooltip = (id: FeaturedObjectiveId | null): string | null =>
    id ? FEATURED_OBJECTIVE_HUD_TOOLTIPS[id] : null;

export interface FloorScheduleEntry {
    mutators: MutatorId[];
    floorTag: FloorTag;
    floorArchetypeId: FloorArchetypeId | null;
    featuredObjectiveId: FeaturedObjectiveId | null;
    cycleFloor: number | null;
    actId: ChapterActId | null;
    actTitle: string | null;
    actFloorNumber: number | null;
    actFloorCount: number | null;
    biomeId: ChapterBiomeId | null;
    biomeTitle: string | null;
    biomeTone: string | null;
    title: string | null;
    hint: string | null;
    theme: string | null;
    riskProfile: string | null;
}

export type ChapterActId = 'act_1_survey' | 'act_2_shadow' | 'act_3_convergence';
export type ChapterBiomeId = 'lantern_academy' | 'shadow_archive' | 'spire_convergence';

export interface ChapterActBiomeDefinition {
    actId: ChapterActId;
    actTitle: string;
    firstCycleFloor: number;
    lastCycleFloor: number;
    biomeId: ChapterBiomeId;
    biomeTitle: string;
    biomeTone: string;
    paletteHook: string;
    audioHook: string;
    pressureCue: string;
    routePreview: string;
    gateRule: string;
}

const SURVEY_GROUNDS_CHAPTER_ACT_BIOME = {
    actId: 'act_1_survey',
    actTitle: 'Act I — Survey Grounds',
    firstCycleFloor: 1,
    lastCycleFloor: 4,
    biomeId: 'lantern_academy',
    biomeTitle: 'Lantern Academy',
    biomeTone: 'Readable halls, early treasure, and silhouette onboarding.',
    paletteHook: 'warm_lantern_gold',
    audioHook: 'lantern_study_pulse',
    pressureCue: 'Readable recall pressure with one early reward reset.',
    routePreview: 'Expect readable halls, a speed check, treasure relief, then silhouette pressure.',
    gateRule: 'Floors 1-4 of each endless cycle.'
} as const satisfies ChapterActBiomeDefinition;

export const CHAPTER_ACT_BIOME_STRUCTURE: readonly ChapterActBiomeDefinition[] = [
    SURVEY_GROUNDS_CHAPTER_ACT_BIOME,
    {
        actId: 'act_2_shadow',
        actTitle: 'Act II — Shadow Archive',
        firstCycleFloor: 5,
        lastCycleFloor: 8,
        biomeId: 'shadow_archive',
        biomeTitle: 'Shadow Archive',
        biomeTone: 'Anchor tracking, breather recovery, trap boss, and script pressure.',
        paletteHook: 'cool_archive_violet',
        audioHook: 'shadow_anchor_tick',
        pressureCue: 'Anchor tracking rises into a trap boss before script pressure.',
        routePreview: 'Expect anchor tracking, one breather, a trap boss, then letter-symbol pressure.',
        gateRule: 'Floors 5-8 of each endless cycle.'
    },
    {
        actId: 'act_3_convergence',
        actTitle: 'Act III — Spire Convergence',
        firstCycleFloor: 9,
        lastCycleFloor: 12,
        biomeId: 'spire_convergence',
        biomeTitle: 'Spire Convergence',
        biomeTone: 'A second warden, treasure reset, parasite sustain, and spotlight finale.',
        paletteHook: 'spire_prismatic_alarm',
        audioHook: 'spire_recall_alarm',
        pressureCue: 'The cycle\'s second warden and sustain pressure frame the final read.',
        routePreview: 'Expect a second warden, a treasure reset, parasite sustain, then spotlight rotation.',
        gateRule: 'Floors 9-12 of each endless cycle.'
    }
] as const;

const DEFAULT_CHAPTER_ACT_BIOME_DEFINITION: ChapterActBiomeDefinition =
    SURVEY_GROUNDS_CHAPTER_ACT_BIOME;

export const ENDLESS_CYCLE_FLOOR_COUNT = 12;

export type FloorArchetypePressureRole =
    | 'baseline'
    | 'pressure'
    | 'reward'
    | 'recovery'
    | 'boss'
    | 'mystery';

export interface FloorArchetypeProgressionRow {
    cycleFloor: number;
    floorArchetypeId: FloorArchetypeId;
    title: string;
    floorTag: FloorTag;
    featuredObjectiveId: FeaturedObjectiveId;
    mutators: readonly MutatorId[];
    role: FloorArchetypePressureRole;
    routeAffinity: RouteNodeType;
    budgetExpectation: string;
    softlockInvariant: string;
    actId: ChapterActId;
    actTitle: string;
    biomeId: ChapterBiomeId;
    biomeTitle: string;
}

export interface FloorArchetypeFrequencyBand {
    role: FloorArchetypePressureRole;
    minPerCycle: number;
    maxPerCycle: number;
}

export interface FloorArchetypeProgressionReport {
    floorsSampled: number;
    cycleLength: number;
    rows: readonly FloorArchetypeProgressionRow[];
    frequencyBands: readonly FloorArchetypeFrequencyBand[];
    roleCounts: Record<FloorArchetypePressureRole, number>;
    archetypeCounts: Partial<Record<FloorArchetypeId, number>>;
    floorTagCounts: Record<FloorTag, number>;
    featuredObjectiveCounts: Partial<Record<FeaturedObjectiveId, number>>;
    hasPressure: boolean;
    hasRecovery: boolean;
    hasReward: boolean;
    hasBoss: boolean;
    hasMystery: boolean;
}

export interface ChapterActBiomePresentation {
    actId: ChapterActId;
    actTitle: string;
    biomeId: ChapterBiomeId;
    biomeTitle: string;
    biomeTone: string;
    actProgress: string;
    paletteHook: string;
    audioHook: string;
    pressureCue: string;
    routePreview: string;
    gateRule: string;
}

export const getChapterActBiomeForCycleFloor = (
    cycleFloor: number
): (ChapterActBiomeDefinition & { actFloorNumber: number; actFloorCount: number }) => {
    const safeCycleFloor = runNonNegativeIntegerWithFallback(cycleFloor, 1);
    const normalized = ((Math.max(1, safeCycleFloor) - 1) % ENDLESS_CYCLE_FLOOR_COUNT) + 1;
    const definition = CHAPTER_ACT_BIOME_STRUCTURE.find(
        (act) => normalized >= act.firstCycleFloor && normalized <= act.lastCycleFloor
    ) ?? DEFAULT_CHAPTER_ACT_BIOME_DEFINITION;
    return {
        ...definition,
        actFloorNumber: normalized - definition.firstCycleFloor + 1,
        actFloorCount: definition.lastCycleFloor - definition.firstCycleFloor + 1
    };
};

export const getChapterActBiomePresentation = (cycleFloor: number): ChapterActBiomePresentation => {
    const definition = getChapterActBiomeForCycleFloor(cycleFloor);
    return {
        actId: definition.actId,
        actTitle: definition.actTitle,
        biomeId: definition.biomeId,
        biomeTitle: definition.biomeTitle,
        biomeTone: definition.biomeTone,
        actProgress: `${definition.actFloorNumber}/${definition.actFloorCount}`,
        paletteHook: definition.paletteHook,
        audioHook: definition.audioHook,
        pressureCue: definition.pressureCue,
        routePreview: definition.routePreview,
        gateRule: definition.gateRule
    };
};

const EMPTY_FLOOR_SCHEDULE_ENTRY: FloorScheduleEntry = {
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
};

const makeEntry = (
    cycleFloor: number,
    floorArchetypeId: FloorArchetypeId,
    featuredObjectiveId: FeaturedObjectiveId,
    mutators: MutatorId[],
    floorTag: FloorTag
): FloorScheduleEntry => {
    const archetype = FLOOR_ARCHETYPE_CATALOG[floorArchetypeId];
    const actBiome = getChapterActBiomeForCycleFloor(cycleFloor);
    return {
        mutators,
        floorTag,
        floorArchetypeId,
        featuredObjectiveId,
        cycleFloor,
        actId: actBiome.actId,
        actTitle: actBiome.actTitle,
        actFloorNumber: actBiome.actFloorNumber,
        actFloorCount: actBiome.actFloorCount,
        biomeId: actBiome.biomeId,
        biomeTitle: actBiome.biomeTitle,
        biomeTone: actBiome.biomeTone,
        title: archetype.title,
        hint: archetype.hint,
        theme: archetype.theme,
        riskProfile: archetype.riskProfile
    };
};

/**
 * One authored chapter per step in the endless cycle (level 1 = index 0).
 * `wide_recall`, `silhouette_twist`, and `distraction_channel` pair with renderer styling and flat per-match penalties in `game.ts`.
 */
const ENDLESS_FLOOR_CYCLE: FloorScheduleEntry[] = [
    makeEntry(1, 'survey_hall', 'flip_par', ['wide_recall'], 'normal'),
    makeEntry(2, 'speed_trial', 'flip_par', ['short_memorize'], 'normal'),
    makeEntry(3, 'treasure_gallery', 'scholar_style', ['findables_floor'], 'breather'),
    makeEntry(4, 'shadow_read', 'cursed_last', ['silhouette_twist'], 'normal'),
    makeEntry(5, 'anchor_chain', 'cursed_last', ['n_back_anchor'], 'normal'),
    makeEntry(6, 'breather', 'scholar_style', [], 'breather'),
    makeEntry(7, 'trap_hall', 'glass_witness', ['glass_floor', 'sticky_fingers'], 'boss'),
    makeEntry(8, 'script_room', 'flip_par', ['category_letters'], 'normal'),
    makeEntry(9, 'rush_recall', 'flip_par', ['short_memorize', 'wide_recall'], 'boss'),
    /*
     * Floor 10 used to be a byte-for-byte copy of floor 3, so one cycle repeated itself. It is now
     * the shrine breather: `generous_shrine` had full mechanical support in the relic-offer rules
     * and a Codex entry, but nothing scheduled it and no mode pooled it, so the +1 relic pick it
     * grants had never once reached a player.
     */
    makeEntry(10, 'treasure_gallery', 'scholar_style', ['findables_floor', 'generous_shrine'], 'breather'),
    makeEntry(11, 'parasite_tithe', 'scholar_style', ['score_parasite'], 'normal'),
    makeEntry(12, 'spotlight_hunt', 'cursed_last', ['shifting_spotlight'], 'normal')
];

/**
 * The warden rotation.
 *
 * The cycle keeps both boss floors where they are, and the trap hall at position 7 keeps its
 * warden: the balance profile leans on that floor's trap budget for how a greedy run heals,
 * and swapping it pushed low-life floors from a third of a run to nearly half. Position 9 is
 * the one that rotates, so a run meets the Rush Sentinel, then the Gilded Keeper, then the
 * Mnemonist Observer across three cycles. `dungeonBossForFloor` reads the archetype, so each
 * warden arrives on the floor its pattern was written for - guard on treasure and locks,
 * observe on encounters. Two of these wardens were fully written and unreachable before.
 */
const POSITION_NINE_WARDEN_ROTATION: readonly FloorScheduleEntry[] = [
    makeEntry(9, 'rush_recall', 'flip_par', ['short_memorize', 'wide_recall'], 'boss'),
    makeEntry(9, 'treasure_gallery', 'glass_witness', ['findables_floor'], 'boss'),
    makeEntry(9, 'spotlight_hunt', 'flip_par', ['shifting_spotlight'], 'boss')
];

const BOSS_ROTATION_CYCLE_POSITION = 9;

const DEFAULT_ENDLESS_FLOOR_ENTRY = ENDLESS_FLOOR_CYCLE[0] ?? EMPTY_FLOOR_SCHEDULE_ENTRY;

const FLOOR_ARCHETYPE_FREQUENCY_BANDS: readonly FloorArchetypeFrequencyBand[] = [
    { role: 'baseline', minPerCycle: 1, maxPerCycle: 2 },
    { role: 'pressure', minPerCycle: 4, maxPerCycle: 6 },
    { role: 'reward', minPerCycle: 2, maxPerCycle: 2 },
    { role: 'recovery', minPerCycle: 1, maxPerCycle: 1 },
    { role: 'boss', minPerCycle: 2, maxPerCycle: 2 },
    { role: 'mystery', minPerCycle: 1, maxPerCycle: 1 }
] as const;

const emptyRoleCounts = (): Record<FloorArchetypePressureRole, number> => ({
    baseline: 0,
    pressure: 0,
    reward: 0,
    recovery: 0,
    boss: 0,
    mystery: 0
});

const emptyFloorTagCounts = (): Record<FloorTag, number> => ({
    normal: 0,
    breather: 0,
    boss: 0
});

const roleForArchetype = (entry: FloorScheduleEntry): FloorArchetypePressureRole => {
    if (entry.floorTag === 'boss') {
        return 'boss';
    }
    if (entry.floorArchetypeId === 'treasure_gallery') {
        return 'reward';
    }
    if (entry.floorArchetypeId === 'breather') {
        return 'recovery';
    }
    if (entry.floorArchetypeId === 'script_room') {
        return 'mystery';
    }
    if (entry.floorArchetypeId === 'survey_hall') {
        return 'baseline';
    }
    return 'pressure';
};

const routeAffinityForArchetype = (entry: FloorScheduleEntry): RouteNodeType => {
    if (entry.floorArchetypeId === 'treasure_gallery' || entry.floorArchetypeId === 'script_room') {
        return 'mystery';
    }
    if (entry.floorArchetypeId === 'breather' || entry.floorArchetypeId === 'survey_hall') {
        return 'safe';
    }
    return 'greed';
};

const budgetExpectationForRole = (role: FloorArchetypePressureRole): string => {
    switch (role) {
        case 'baseline':
            return 'standard enemy budget with readable recall pressure';
        case 'pressure':
            return 'elevated hazard or mutator budget with normal completion route';
        case 'reward':
            return 'pickup and cache reward budget with reduced combat pressure';
        case 'recovery':
            return 'lower threat utility budget for resource recovery';
        case 'boss':
            return 'boss or trap-heavy budget with explicit defeat objective support';
        case 'mystery':
            return 'event-style information budget with altered card reading';
    }
};

const progressionRowForEntry = (entry: FloorScheduleEntry): FloorArchetypeProgressionRow | null => {
    if (
        entry.cycleFloor == null ||
        entry.floorArchetypeId == null ||
        entry.featuredObjectiveId == null ||
        entry.title == null ||
        entry.actId == null ||
        entry.actTitle == null ||
        entry.biomeId == null ||
        entry.biomeTitle == null
    ) {
        return null;
    }
    const role = roleForArchetype(entry);
    return {
        cycleFloor: entry.cycleFloor,
        floorArchetypeId: entry.floorArchetypeId,
        title: entry.title,
        floorTag: entry.floorTag,
        featuredObjectiveId: entry.featuredObjectiveId,
        mutators: [...entry.mutators],
        role,
        routeAffinity: routeAffinityForArchetype(entry),
        budgetExpectation: budgetExpectationForRole(role),
        softlockInvariant:
            'inspectBoardFairness and inspectDungeonBoardTopology must report completion, lock, and objective routes for generated samples.',
        actId: entry.actId,
        actTitle: entry.actTitle,
        biomeId: entry.biomeId,
        biomeTitle: entry.biomeTitle
    };
};

export const getFloorArchetypeProgressionRows = (): readonly FloorArchetypeProgressionRow[] =>
    ENDLESS_FLOOR_CYCLE.map((entry) => progressionRowForEntry(entry)).filter(
        (row): row is FloorArchetypeProgressionRow => row != null
    );

export const getFloorArchetypeProgressionReport = (
    floors = ENDLESS_CYCLE_FLOOR_COUNT,
    runSeed = 12_012,
    rulesVersion = FLOOR_SCHEDULE_RULES_VERSION
): FloorArchetypeProgressionReport => {
    const roleCounts = emptyRoleCounts();
    const archetypeCounts: Partial<Record<FloorArchetypeId, number>> = {};
    const floorTagCounts = emptyFloorTagCounts();
    const featuredObjectiveCounts: Partial<Record<FeaturedObjectiveId, number>> = {};
    const rows: FloorArchetypeProgressionRow[] = [];
    const floorsSampled = runNonNegativeIntegerWithFallback(floors, ENDLESS_CYCLE_FLOOR_COUNT);

    for (let level = 1; level <= floorsSampled; level += 1) {
        const row = progressionRowForEntry(
            pickFloorScheduleEntry(runSeed, rulesVersion, level, 'endless')
        );
        if (!row) {
            continue;
        }
        rows.push(row);
        roleCounts[row.role] += 1;
        archetypeCounts[row.floorArchetypeId] = (archetypeCounts[row.floorArchetypeId] ?? 0) + 1;
        floorTagCounts[row.floorTag] += 1;
        featuredObjectiveCounts[row.featuredObjectiveId] =
            (featuredObjectiveCounts[row.featuredObjectiveId] ?? 0) + 1;
    }

    return {
        floorsSampled,
        cycleLength: ENDLESS_CYCLE_FLOOR_COUNT,
        rows,
        frequencyBands: FLOOR_ARCHETYPE_FREQUENCY_BANDS,
        roleCounts,
        archetypeCounts,
        floorTagCounts,
        featuredObjectiveCounts,
        hasPressure: roleCounts.pressure > 0,
        hasRecovery: roleCounts.recovery > 0,
        hasReward: roleCounts.reward > 0,
        hasBoss: roleCounts.boss > 0,
        hasMystery: roleCounts.mystery > 0
    };
};

export const getFloorArchetypeDefinition = (
    id: FloorArchetypeId | null
): FloorArchetypeDefinition | null => (id ? FLOOR_ARCHETYPE_CATALOG[id] : null);

export const getFeaturedObjectiveLabel = (id: FeaturedObjectiveId | null): string | null =>
    id ? FEATURED_OBJECTIVE_LABELS[id] : null;

export const getFloorChapterIdentity = (
    entry: FloorScheduleEntry
): {
    chapterTheme: string | null;
    actTitle: string | null;
    biomeTitle: string | null;
    biomeTone: string | null;
    actProgress: string | null;
    riskProfile: string | null;
    paletteHook: string | null;
    audioHook: string | null;
    pressureCue: string | null;
    routePreview: string | null;
    mutatorTitles: string[];
} => {
    const biomePresentation =
        entry.cycleFloor != null ? getChapterActBiomePresentation(entry.cycleFloor) : null;
    return {
        chapterTheme: entry.theme,
        actTitle: entry.actTitle,
        biomeTitle: entry.biomeTitle,
        biomeTone: entry.biomeTone,
        actProgress:
            entry.actFloorNumber != null && entry.actFloorCount != null
                ? `${entry.actFloorNumber}/${entry.actFloorCount}`
                : null,
        riskProfile: entry.riskProfile,
        paletteHook: biomePresentation?.paletteHook ?? null,
        audioHook: biomePresentation?.audioHook ?? null,
        pressureCue: biomePresentation?.pressureCue ?? null,
        routePreview: biomePresentation?.routePreview ?? null,
        mutatorTitles: entry.mutators.map((id) => id.replace(/_/g, ' '))
    };
};

/**
 * Deterministic mutators + pacing tag for endless (rules v3+).
 * Other modes: returns empty mutators; caller keeps run mutators.
 */
export const pickFloorScheduleEntry = (
    runSeed: number,
    rulesVersion: number,
    level: number,
    gameMode: GameMode
): FloorScheduleEntry => {
    if (gameMode !== 'endless' || rulesVersion < FLOOR_SCHEDULE_RULES_VERSION) {
        return EMPTY_FLOOR_SCHEDULE_ENTRY;
    }
    const safeLevel = runNonNegativeIntegerWithFallback(level, 1);
    const idx = Math.max(0, safeLevel - 1) % ENDLESS_FLOOR_CYCLE.length;
    const cycleIndex = Math.floor(Math.max(0, safeLevel - 1) / ENDLESS_FLOOR_CYCLE.length);
    const rotated =
        idx + 1 === BOSS_ROTATION_CYCLE_POSITION
            ? POSITION_NINE_WARDEN_ROTATION[cycleIndex % POSITION_NINE_WARDEN_ROTATION.length]
            : undefined;
    const base = rotated ?? ENDLESS_FLOOR_CYCLE[idx] ?? DEFAULT_ENDLESS_FLOOR_ENTRY;
    const rng = createMulberry32(hashStringToSeed(`floorSchedule:${rulesVersion}:${runSeed}:${level}`));
    /** Optional micro-variation: swap in distraction_channel on ~1/4 boss floors (seeded). */
    if (base.floorTag === 'boss' && rng() < 0.25) {
        const mutators = [...base.mutators];
        if (!mutators.includes('distraction_channel') && mutators.length < 3) {
            return { ...base, mutators: [...mutators, 'distraction_channel'] };
        }
    }
    return { ...base, mutators: [...base.mutators] };
};

export const usesEndlessFloorSchedule = (gameMode: GameMode, rulesVersion: number): boolean =>
    gameMode === 'endless' && rulesVersion >= FLOOR_SCHEDULE_RULES_VERSION;
