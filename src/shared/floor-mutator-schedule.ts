import { CARTOGRAPHER_RULES_FROM } from './cartographer-rules';
import { KEEPER_RULES_FROM } from './keeper-rules';
import type {
    FeaturedObjectiveId,
    FloorArchetypeId,
    FloorTag,
    GameMode,
    MutatorId
} from './contracts';
import { createMulberry32, hashStringToSeed } from './rng';
import { runNonNegativeIntegerWithFallback } from './run-number-guards';
import { signatureCyclePosition } from './run-signature-rules';

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
/*
 * 5 (2026-10-19, DGE-002): the sixty-floor Descent. Floors resolve through `DESCENT_ACTS`: Act I is
 * the shipped cycle unchanged, Acts II to IV keep the cycle's entries on their own floors and
 * reserve their last floor (24, 40, 60) for the act's boss, and past 60 the Abyss repeats until
 * Endless has its own rule (DGE-006). Schedule-only: `GAME_RULES_VERSION` is not bumped (CLAUDE.md),
 * so a seed already shared meets the new boss floors - that trade is the owner's.
 */
/*
 * 6 (2026-10-20, DGE-005): floor 60 is the Warden's hall, the Descent's end. Schedule-only like 5:
 * no generation before floor 60 changes, so `GAME_RULES_VERSION` stays.
 */
/*
 * 7 (2026-10-20, DGE-006): past floor 60 the acts repeat in Endless cycles, each half as long as the
 * last, instead of the Abyss repeating. Schedule-only: nothing to floor 60 changes.
 */
export const FLOOR_SCHEDULE_RULES_VERSION = 7;

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
        hint: 'First room: read the clumps and the pairs before the descent picks up.',
        theme: 'Gate',
        riskProfile: 'Readable opener; clear it under par to set the run\'s pace.'
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
        riskProfile: 'Pickup-rich breather; the pickups pay on the match, so take the carrier pairs.'
    },
    shadow_read: {
        title: 'Shadow Read',
        hint: 'Silhouettes hide detail. Leave the cursed pair for last.',
        theme: 'Shadow',
        riskProfile: 'Silhouette pressure; identify the cursed pair before clearing.'
    },
    anchor_chain: {
        title: 'Anchor Chain',
        hint: 'One card is marked: find its partner and match them for an extra chain link before the anchor moves on.',
        theme: 'Anchor',
        riskProfile: 'A standing offer of chain: the marked card tells you half of a pair, your memory has to supply the rest.'
    },
    trap_hall: {
        title: 'Trap Hall',
        hint: 'Sticky fingers: every match marks a card beside it that cannot open your next turn. Open elsewhere.',
        theme: 'Trap',
        riskProfile: 'Flip-order pressure on a boss budget; the card you remember best is often the one you may not open with.',
        encounterRole: 'boss'
    },
    restless_hall: {
        title: 'Restless Hall',
        hint: 'Every third turn the floor shifts under you, and it shifts more the longer you stay. Finish within par.',
        theme: 'Restless',
        riskProfile: 'Hidden cards trade places on a clock you are winding; clear what you know before the floor takes it back.'
    },
    rush_recall: {
        title: 'Rush Recall',
        hint: 'Short study and wide recall collide. Boss floors reward sharp clears.',
        theme: 'Rush',
        riskProfile: 'Boss pressure with short study and wider recall.',
        encounterRole: 'boss'
    },
    spiral_hall: {
        title: 'The Spiral',
        hint: 'Survive to par. Clear the outer ring and it seals, and fresh pairs are dealt inside it. Score, not clearance, is the goal.',
        theme: 'Spiral',
        riskProfile: 'An Abyss floor that never empties: the rings close in, and the turns to par are all there is.'
    },
    cartographer_hall: {
        title: 'The Cartographer',
        hint: 'Two decks deep, and the lower deck is charted for the study window. Every third match it turns a quarter, clockwise; a pinned card keeps what lies under it.',
        theme: 'Cartographer',
        riskProfile: 'The Deep\u2019s boss: the map in your head, both layers of it, turned under you every third match.'
    },
    keeper_hall: {
        title: 'The Keeper of Halls',
        hint: 'Two rooms and a doorway, and every fourth turn the rooms swap sides. Each card keeps its place inside its room; a pinned card stays where it is.',
        theme: 'Keeper',
        riskProfile: 'The Living Dungeon\u2019s boss: the Fold, with rooms that will not stay put. What you know stays true, a room\u2019s width over.'
    },
    warden_hall: {
        title: "The Warden's Hall",
        hint: 'Every turn past par takes a miss from your bank, and every fifth turn the face-down cards are dealt again. Clear it and the run is won.',
        theme: 'Warden',
        riskProfile: 'The Descent\u2019s last floor and its designed end: a race against par with the board you learned shuffled under you.'
    },
    mirror_hall: {
        title: 'Looking-Glass Hall',
        hint: 'Every third match turns the board over in a mirror. Everything you know stays true - reflected.',
        theme: 'Glass',
        riskProfile: 'A boss floor that tests the map in your head: the board you learned turns over every third match.'
    },
    lantern_hall: {
        title: 'Lantern Hall',
        hint: 'Every match lights the cards beside it until you turn the next one. Match where the dark is.',
        theme: 'Lantern',
        riskProfile: 'A reward floor that pays in knowledge: where you match decides how much you get to see.'
    },
    skittish_hall: {
        title: 'Skittish Hall',
        hint: 'Miss here and the two cards you saw flinch into a neighbouring cell. Work out which way.',
        theme: 'Skittish',
        riskProfile: 'Every miss moves the two faces it showed one step; a clean floor never flinches.'
    },
    spotlight_hunt: {
        title: 'Spotlight Hunt',
        hint: 'Ward and bounty drift after every turn. Save the cursed pair for last.',
        theme: 'Spotlight',
        riskProfile: 'Ward/bounty rotation; re-evaluate targets after each resolve.'
    },
    breather: {
        title: 'Breather',
        hint: 'A calmer floor to steady the board and rebuild the chain.',
        theme: 'Breather',
        riskProfile: 'Lower pressure; rebuild resources and protect streaks.'
    }
};

export const FEATURED_OBJECTIVE_LABELS: Record<FeaturedObjectiveId, string> = {
    amplified_reaction: 'Amplified reaction',
    calm_reaction: 'Calm the realm',
    scholar_style: 'Scholar style',
    cursed_last: 'Cursed last',
    flip_par: 'Flip par'
};

/** Endless objective pill `title` — align with `isFeaturedObjectiveCompleted` in `game.ts`. */
export const FEATURED_OBJECTIVE_HUD_TOOLTIPS: Record<FeaturedObjectiveId, string> = {
    amplified_reaction: 'Match two pairs of one element, then a different element without a miss to trigger an amplified reaction.',
    calm_reaction: 'Match two Water pairs, then an Ice pair without a miss: Freeze-over holds realm hazards still.',
    flip_par:
        'Turns this floor (each pair of flips resolved, match or miss; the gambit is one turn) must stay at or below the floor par shown on the run bar.',
    scholar_style: 'Do not use board shuffle or tile swap on this floor.',
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
        biomeTone: 'A second boss floor, a pickup reset, a static hall, and a spotlight finale.',
        paletteHook: 'spire_prismatic_alarm',
        audioHook: 'spire_recall_alarm',
        pressureCue: 'The cycle\'s second boss floor and sustain pressure frame the final read.',
        routePreview: 'Expect a second boss floor, a pickup reset, a static hall, then spotlight rotation.',
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
    /*
     * The breather is where the magpie nests, and it is the only floor in the cycle that had no
     * mutator at all — a slot that did nothing on a floor that asks nothing. The bird fits it
     * exactly: it costs no lives and no points, so the floor keeps its job of letting a run heal,
     * but it stops the safe floor from being free. A player who spends it clearing pairs and
     * missing three times will find out what it is for.
     */
    makeEntry(6, 'breather', 'scholar_style', ['magpie_thief'], 'breather'),
    /*
     * Floor 7 lost the glass decoy with the rest of the fake cards (Gen 196). Sticky fingers still
     * makes it the awkward floor of the cycle, and the objective it carries is the one the decoy
     * used to guard: get through the floor without a mismatch taking a tile you already learned.
     */
    makeEntry(7, 'trap_hall', 'scholar_style', ['sticky_fingers'], 'boss'),
    makeEntry(8, 'restless_hall', 'flip_par', ['restless_floor'], 'normal'),
    makeEntry(9, 'rush_recall', 'flip_par', ['short_memorize', 'wide_recall'], 'boss'),
    /*
     * Floor 10 is the back half's pickup breather. The shrine mutator that once told it apart from
     * floor 3 went with the relic draft, so the objective does instead: floor 3 asks for a floor
     * without moving the board, floor 10 asks for one under par.
     */
    makeEntry(10, 'lantern_hall', 'flip_par', ['lantern_light'], 'breather'),
    makeEntry(11, 'skittish_hall', 'scholar_style', ['skittish_cards'], 'normal'),
    makeEntry(12, 'spotlight_hunt', 'cursed_last', ['shifting_spotlight'], 'normal')
];

/**
 * The position-nine rotation.
 *
 * The cycle keeps both boss floors where they are; the trap hall at position 7 stays put because
 * the balance profile leans on it for how a run heals, and swapping it pushed low-life floors
 * from a third of a run to nearly half. Position 9 is the one that rotates, so the second boss
 * floor of each cycle is a different room three cycles running. It once decided which warden
 * a run met; the wardens went with the dungeon, and what rotates now is the room itself.
 */
const POSITION_NINE_ROTATION: readonly FloorScheduleEntry[] = [
    /*
     * The Looking-Glass Hall opens the rotation, the first boss room a run meets past floor 8. It
     * took the spotlight hunt's turn: that room is floor 12 of every cycle already, so as a boss it
     * was a repeat, and the rotation's promise - every warden by floor 33 - holds with three rooms.
     */
    makeEntry(9, 'mirror_hall', 'flip_par', ['looking_glass'], 'boss'),
    makeEntry(9, 'rush_recall', 'flip_par', ['short_memorize', 'wide_recall'], 'boss'),
    makeEntry(9, 'treasure_gallery', 'scholar_style', ['findables_floor'], 'boss')
];

const BOSS_ROTATION_CYCLE_POSITION = 9;

/** The Descent's four acts (`tasks/deep-game-epic/02-deep-game-plan.md`). */
export type DescentActId = 'gate' | 'living_dungeon' | 'deep' | 'abyss';

export interface DescentActDefinition {
    readonly id: DescentActId;
    readonly title: string;
    readonly firstFloor: number;
    readonly lastFloor: number;
    /** The act's boss floor, its last; null for the Gate, whose bosses are the cycle's own (7 and 9). */
    readonly bossFloor: number | null;
    /** The entry the boss floor resolves to. Until DGE-011, DGE-018 and DGE-005 give each act its boss, a stacked room. */
    readonly boss: FloorScheduleEntry | null;
}

/**
 * The Descent: four acts to floor 60, replacing a twelve-floor cycle that repeated until floor 40
 * played like floor 4 (DGE-002). Each act's body keeps the cycle's entries on the floors they always
 * had, so nothing a run already met moves; what is new is each act's boss floor, a room whose
 * mutators stack the way no earlier floor does - the "something new every act" bar - carrying the
 * Keystone Warden identity every boss floor reads (`boss-encounters.ts`) until the act bosses land.
 */
export const DESCENT_ACTS: readonly DescentActDefinition[] = [
    { id: 'gate', title: 'The Gate', firstFloor: 1, lastFloor: 12, bossFloor: null, boss: null },
    {
        id: 'living_dungeon',
        title: 'The Living Dungeon',
        firstFloor: 13,
        lastFloor: 24,
        bossFloor: 24,
        boss: makeEntry(12, 'spotlight_hunt', 'cursed_last', ['shifting_spotlight', 'restless_floor'], 'boss')
    },
    {
        id: 'deep',
        title: 'The Deep',
        firstFloor: 25,
        lastFloor: 40,
        bossFloor: 40,
        boss: makeEntry(4, 'mirror_hall', 'flip_par', ['looking_glass', 'skittish_cards'], 'boss')
    },
    {
        id: 'abyss',
        title: 'The Abyss',
        firstFloor: 41,
        lastFloor: 60,
        bossFloor: 60,
        // The Warden (DGE-005): its rules are its hall's, so no mutator moves a card in the same turn.
        boss: makeEntry(12, 'warden_hall', 'scholar_style', [], 'boss')
    }
];

/** The Keeper of Halls (DGE-011): a Fold whose rooms swap; the spotlight stays, the restless drift goes (one board-mover is the rule). */
const KEEPER_BOSS_ENTRY = makeEntry(12, 'keeper_hall', 'cursed_last', ['shifting_spotlight'], 'boss');

/** The Cartographer (DGE-018): Layers on the boss floor, the lower deck turning; the looking glass and the flinch go (one board-mover is the rule). */
const CARTOGRAPHER_BOSS_ENTRY = makeEntry(4, 'cartographer_hall', 'flip_par', [], 'boss');

/** The Spiral's floors (`spiral-rules.ts` `SPIRAL_DESCENT_FLOORS`): its objective never asks for an empty board or a par flip count. */
const SPIRAL_FLOORS: readonly number[] = [44, 56];
const SPIRAL_ENTRY = (cycleFloor: number): FloorScheduleEntry => makeEntry(cycleFloor, 'spiral_hall', 'scholar_style', [], 'normal');

/** The Descent's last floor: the Warden's (DGE-005). */
export const DESCENT_FLOOR_COUNT = 60;

const ABYSS = DESCENT_ACTS[DESCENT_ACTS.length - 1]!;

/**
 * Endless (DGE-006, 2026-10-20): past the Warden the four acts come round again, each cycle every act
 * half as long as the cycle before (never under `ENDLESS_ACT_MIN_FLOORS`), and each still ends on its
 * boss. Cycle 1 is 6 + 6 + 8 + 10 floors (61-90), cycle 2 is 4 + 4 + 4 + 5, and from cycle 3 every act
 * is four floors. A floor plays as the Descent floor at the same share of its act, so the act's first
 * floor plays as the act's first and its last as the act's boss.
 */
export const ENDLESS_ACT_MIN_FLOORS = 4;

export interface EndlessPlace {
    /** 1 for floors 61-90, then 2, 3, ... */
    readonly cycle: number;
    readonly act: DescentActDefinition;
    /** The first and last floor of this act in this cycle. */
    readonly firstLevel: number;
    readonly lastLevel: number;
    /** The Descent floor this floor plays as. */
    readonly descentFloor: number;
}

const actLength = (act: DescentActDefinition): number => act.lastFloor - act.firstFloor + 1;

/** How long an act runs in an Endless cycle. */
export const endlessActLength = (act: DescentActDefinition, cycle: number): number =>
    Math.max(ENDLESS_ACT_MIN_FLOORS, Math.round(actLength(act) / 2 ** Math.max(1, Math.floor(cycle))));

/** Where a floor past 60 stands in Endless; null on the Descent itself. */
export const endlessPlaceForLevel = (level: number): EndlessPlace | null => {
    const floor = Math.floor(Number.isFinite(level) ? level : 1);
    if (floor <= DESCENT_FLOOR_COUNT) return null;
    let start = DESCENT_FLOOR_COUNT + 1;
    for (let cycle = 1; ; cycle += 1) {
        for (const act of DESCENT_ACTS) {
            const length = endlessActLength(act, cycle);
            if (floor < start + length) {
                const position = floor - start;
                const span = actLength(act) - 1;
                const descentFloor = act.firstFloor + (length === 1 ? span : Math.round((position * span) / (length - 1)));
                return { cycle, act, firstLevel: start, lastLevel: start + length - 1, descentFloor };
            }
            start += length;
        }
    }
};

/** The Descent floor a level plays as: itself to 60, then its place in an Endless cycle. */
const descentFloorOf = (level: number): number => endlessPlaceForLevel(level)?.descentFloor ?? level;

/** Whether a level is an act's boss floor: 24, 40, 60, and each Endless act's last (`boss-reward-rules.ts`). */
export const isActBossFloor = (level: number): boolean => {
    const floor = descentFloorOf(Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
    return descentActForFloor(level).bossFloor === floor;
};

/** The act a floor belongs to; past floor 60, the act of its Endless cycle. */
export const descentActForFloor = (level: number): DescentActDefinition => {
    const floor = descentFloorOf(Math.max(1, Math.floor(Number.isFinite(level) ? level : 1)));
    return DESCENT_ACTS.find((act) => floor >= act.firstFloor && floor <= act.lastFloor) ?? ABYSS;
};

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

/**
 * The pacing job a floor's archetype is doing, ignoring its position in the cycle.
 *
 * Exported since Gen 260 so that `sim:archetype-pressure` reads the schedule's own assignment rather
 * than keeping a second copy of it: the whole point of that gate is to check whether these roles
 * describe how the floors actually play, and a gate holding its own private role map could not.
 */
export const pressureRoleForArchetype = (
    floorArchetypeId: FloorArchetypeId | null | undefined
): Exclude<FloorArchetypePressureRole, 'boss'> => {
    if (floorArchetypeId === 'treasure_gallery' || floorArchetypeId === 'lantern_hall') {
        return 'reward';
    }
    if (floorArchetypeId === 'breather') {
        return 'recovery';
    }
    if (floorArchetypeId === 'restless_hall') {
        return 'mystery';
    }
    if (floorArchetypeId === 'survey_hall') {
        return 'baseline';
    }
    // An entry with no archetype at all reads as pressure, which is what this returned before it
    // was extracted - a floor nobody has characterised is not one to call a rest.
    return 'pressure';
};

const roleForArchetype = (entry: FloorScheduleEntry): FloorArchetypePressureRole =>
    entry.floorTag === 'boss' ? 'boss' : pressureRoleForArchetype(entry.floorArchetypeId);

const budgetExpectationForRole = (role: FloorArchetypePressureRole): string => {
    switch (role) {
        case 'baseline':
            return 'standard pair budget with readable recall pressure';
        case 'pressure':
            return 'elevated mutator budget with a normal clear';
        case 'reward':
            return 'pickup reward budget with reduced pressure';
        case 'recovery':
            return 'lower pressure budget for resource recovery';
        case 'boss':
            return 'boss-multiplier floor with a trap-style mutator';
        case 'mystery':
            return 'information budget with altered tile reading';
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
        budgetExpectation: budgetExpectationForRole(role),
        softlockInvariant:
            'inspectBoardFairness must report a completion route for generated samples.',
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
    // The Descent (DGE-002): an act's boss floor is its own room; every other floor keeps the
    // cycle's arithmetic on the Descent floor it plays as, so floors 1-60 resolve as they always did.
    const descentFloor = descentFloorOf(Math.max(1, safeLevel));
    const act = descentActForFloor(descentFloor);
    const idx = Math.max(0, descentFloor - 1) % ENDLESS_FLOOR_CYCLE.length;
    const cycleIndex = Math.floor(Math.max(0, descentFloor - 1) / ENDLESS_FLOOR_CYCLE.length);
    const rotated =
        idx + 1 === BOSS_ROTATION_CYCLE_POSITION
            ? POSITION_NINE_ROTATION[cycleIndex % POSITION_NINE_ROTATION.length]
            : undefined;
    // The Keeper of Halls (DGE-011, `keeper-rules.ts`): from rules 81 the Living Dungeon's boss is its own hall.
    // The Cartographer (DGE-018, `cartographer-rules.ts`): from rules 82 the Deep's boss is its own hall.
    const actBoss =
        act.bossFloor === descentFloor
            ? act.id === 'living_dungeon' && rulesVersion >= KEEPER_RULES_FROM
                ? KEEPER_BOSS_ENTRY
                : act.id === 'deep' && rulesVersion >= CARTOGRAPHER_RULES_FROM
                  ? CARTOGRAPHER_BOSS_ENTRY
                  : act.boss
            : null;
    // The Spiral (DGE-021, `spiral-rules.ts`): from rules 85, two Abyss floors are survived, not cleared.
    const spiral = !actBoss && rulesVersion >= 85 && SPIRAL_FLOORS.includes(descentFloor) ? SPIRAL_ENTRY(idx + 1) : null;
    // A run's own Gate (`run-signature-rules.ts`, rules 90): the cycle's rooms in the run's order, each
    // keeping its own floor's place in the act.
    const room = ENDLESS_FLOOR_CYCLE[signatureCyclePosition(runSeed, rulesVersion, cycleIndex, idx + 1) - 1];
    const cycleEntry = ENDLESS_FLOOR_CYCLE[idx] && room
        ? { ...ENDLESS_FLOOR_CYCLE[idx]!, floorArchetypeId: room.floorArchetypeId, featuredObjectiveId: room.featuredObjectiveId, mutators: room.mutators, floorTag: room.floorTag }
        : ENDLESS_FLOOR_CYCLE[idx];
    const legacyBase = actBoss ?? spiral ?? rotated ?? cycleEntry ?? DEFAULT_ENDLESS_FLOOR_ENTRY;
    const goal = rulesVersion >= 64 && legacyBase.floorArchetypeId === 'anchor_chain' ? 'amplified_reaction'
        : rulesVersion >= 64 && legacyBase.floorArchetypeId === 'trap_hall' ? 'calm_reaction' : null;
    const base: FloorScheduleEntry = goal ? { ...legacyBase, featuredObjectiveId: goal } : legacyBase;
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

/** The chaotic set a Wild run carries on every floor. */
export const CHAOS_MUTATORS: readonly MutatorId[] = ['sticky_fingers', 'short_memorize', 'findables_floor'];

/**
 * From this rules version a Wild run follows the floor schedule like any descent - boss floors and
 * their Colossus, breathers, archetypes, featured goals, the rotating in-play mutators - with its
 * chaos set added on top. Before it, a Wild run skipped the schedule and played the same three
 * mutators on every floor ("a chaotic floor set" that never changed); older saves and share keys
 * keep that.
 */
export const WILD_SCHEDULE_RULES_VERSION = 65;

/** Whether this run's floors come from the schedule. */
export const runFollowsFloorSchedule = (gameMode: GameMode, rulesVersion: number, wildMenuRun: boolean): boolean =>
    usesEndlessFloorSchedule(gameMode, rulesVersion) && (!wildMenuRun || rulesVersion >= WILD_SCHEDULE_RULES_VERSION);

/** A scheduled floor's mutators, with a Wild run's chaos set folded in (each once). */
export const scheduledFloorMutators = (scheduled: readonly MutatorId[], wildMenuRun: boolean): MutatorId[] =>
    wildMenuRun ? [...new Set<MutatorId>([...CHAOS_MUTATORS, ...scheduled])] : [...scheduled];
