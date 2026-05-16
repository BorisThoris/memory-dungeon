/**
 * Product-facing run mode catalog for Choose Your Path (ordered, stable ids).
 * Kept separate from `GameMode` in contracts — entries may share an underlying mode with flags.
 */

export type RunModeGroup = 'core' | 'time_attack' | 'puzzle' | 'training';

export type RunModeAvailability = 'available' | 'locked' | 'disabled';

/** Discriminated actions — no store imports; renderer maps these to `useAppStore` methods. */
export type PuzzleRunModeId = 'starter_pairs' | 'mirror_craft' | 'glyph_cross';

export type RunModeAction =
    | { type: 'startRun' }
    | { type: 'startDungeonShowcaseRun' }
    | { type: 'startDailyRun' }
    | { type: 'locked' }
    | {
          type: 'gauntlet';
          presets: ReadonlyArray<{ label: string; durationMs: number }>;
      }
    | { type: 'puzzle'; puzzleId: PuzzleRunModeId }
    | { type: 'startWildRun' }
    | { type: 'startPracticeRun' }
    | { type: 'startScholarContractRun' }
    | { type: 'startPinVowRun' }
    | { type: 'meditationSetup' };

export interface RunModeDefinition {
    id: string;
    title: string;
    shortDescription: string;
    /** PPI-006: stable player-facing signal that should be visible after this mode starts. */
    startContract?: {
        label: string;
        signal: string;
        testId: string;
    };
    /** REG-050: player promise that differentiates why this mode exists. */
    promise?: string;
    /** REG-050: how achievements/local stats are treated for this mode. */
    eligibilityNote?: string;
    identityTag?: string;
    outcomeSummary?: string;
    /** Extra availability/rules detail for locked or staged modes. */
    availabilityDetail?: string;
    /** REG-081: offline save-derived challenge gate summary for QA and UI. */
    challengeGateId?: string;
    challengeGateSummary?: string;
    group: RunModeGroup;
    availability: RunModeAvailability;
    /** Key into mode poster map (`modeArt.ts`). */
    posterKey: string;
    /** Optional stable selector for automation. */
    testId?: string;
    action: RunModeAction;
}

/** Eyebrow / section order on Choose Your Path. */
export const RUN_MODE_GROUP_ORDER: readonly RunModeGroup[] = [
    'core',
    'time_attack',
    'puzzle',
    'training'
] as const;

export const RUN_MODE_GROUP_LABEL: Record<RunModeGroup, string> = {
    core: 'Core modes',
    time_attack: 'Time attack',
    puzzle: 'Puzzle',
    training: 'Training & contracts'
};

export const RUN_MODE_CATALOG: readonly RunModeDefinition[] = [
    {
        id: 'classic',
        title: 'Classic Run',
        shortDescription: 'Shippable endless-style descent: procedural floors, route choices, shop gold, relic milestones, and escalating pair counts.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Classic Dungeon.',
            testId: 'hud-mode-identity'
        },
        availabilityDetail:
            'This is the live long-run ruleset for v1. It uses the internal endless simulation but is branded Classic until the future ultra-long Endless variant ships.',
        challengeGateId: 'classic_entry',
        challengeGateSummary: 'Unlocked by default; seeds local progress for other challenge gates.',
        group: 'core',
        availability: 'available',
        posterKey: 'classic',
        action: { type: 'startRun' }
    },
    {
        id: 'daily',
        title: 'Daily Challenge',
        shortDescription: 'Shared daily mutators and seed. Resets at UTC midnight.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Daily challenge and shows the UTC daily key.',
            testId: 'hud-mode-identity'
        },
        challengeGateId: 'daily_entry',
        challengeGateSummary: 'Unlocked after first clear; available by default for v1 local play.',
        group: 'core',
        availability: 'available',
        posterKey: 'daily',
        action: { type: 'startDailyRun' }
    },
    {
        id: 'dungeon_showcase',
        title: 'Dungeon Showcase',
        shortDescription: 'Jump straight into a live dungeon board with enemy patrols, route exits, traps, shops, bosses, and locked-room vocabulary.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Dungeon Showcase.',
            testId: 'hud-mode-identity'
        },
        identityTag: 'Dungeon preview',
        promise: 'See the shipped dungeon systems immediately: patrols, route exits, trap vocabulary, boss prep, and locked-room rewards.',
        eligibilityNote: 'Showcase disables achievements and mastery records so it can start on a staged dungeon floor.',
        outcomeSummary: 'Showcase results are practice-only and do not affect daily fairness or Classic mastery.',
        group: 'core',
        availability: 'available',
        posterKey: 'dungeon_showcase',
        testId: 'choose-path-dungeon-showcase',
        action: { type: 'startDungeonShowcaseRun' }
    },
    {
        id: 'endless',
        title: 'Endless Mode',
        shortDescription: 'Upcoming ultra-long variant. Locked intentionally while long-form balance, rewards, and fatigue rules are tuned.',
        startContract: {
            label: 'Start signal',
            signal: 'Locked for v1; no run starts from this card.',
            testId: 'library-mode-detail-modal'
        },
        availabilityDetail:
            'Staged for a later balance pass: Classic already provides procedural long-run play; this card is not an unlock requirement or broken button.',
        group: 'core',
        availability: 'locked',
        posterKey: 'endless',
        testId: 'choose-path-low-cta',
        action: { type: 'locked' }
    },
    {
        id: 'gauntlet',
        title: 'Gauntlet',
        shortDescription: 'Timed pressure run: pick 5, 10, or 15 minutes and race clean floors before the clock seals.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Gauntlet and shows the timer.',
            testId: 'hud-mode-identity'
        },
        identityTag: 'Clock pressure',
        promise: 'Timed mastery — same memory loop, but every decision competes with the countdown.',
        eligibilityNote: 'Achievements stay eligible unless debug/assist rules lock a specific achievement; local honors track Gauntlet proof.',
        outcomeSummary: 'Gauntlet results emphasize timed floor clears and local pressure mastery.',
        challengeGateId: 'gauntlet_entry',
        challengeGateSummary: 'Unlocked after any first clear; available in v1 to avoid blocking timed local play.',
        group: 'time_attack',
        availability: 'available',
        posterKey: 'gauntlet',
        action: {
            type: 'gauntlet',
            presets: [
                { label: '5m', durationMs: 5 * 60 * 1000 },
                { label: '10m', durationMs: 10 * 60 * 1000 },
                { label: '15m', durationMs: 15 * 60 * 1000 }
            ]
        }
    },
    {
        id: 'puzzle_starter',
        title: 'Puzzle',
        shortDescription: 'Curated tile layout; focus on solving the board.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Puzzle: Starter.',
            testId: 'hud-mode-identity'
        },
        group: 'puzzle',
        availability: 'available',
        posterKey: 'puzzle',
        action: { type: 'puzzle', puzzleId: 'starter_pairs' }
    },
    {
        id: 'puzzle_mirror',
        title: 'Mirror Puzzle',
        shortDescription: 'Intermediate mirror craft layout.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Puzzle: Mirror craft.',
            testId: 'hud-mode-identity'
        },
        group: 'puzzle',
        availability: 'available',
        posterKey: 'mirror_puzzle',
        action: { type: 'puzzle', puzzleId: 'mirror_craft' }
    },
    {
        id: 'puzzle_glyph_cross',
        title: 'Glyph Cross',
        shortDescription: 'Advanced 4×2 glyph pattern puzzle.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Puzzle: Glyph Cross.',
            testId: 'hud-mode-identity'
        },
        challengeGateId: 'glyph_cross_entry',
        challengeGateSummary: 'Recommended after two puzzle completions or first clear; playable offline in v1.',
        group: 'puzzle',
        availability: 'available',
        posterKey: 'puzzle',
        action: { type: 'puzzle', puzzleId: 'glyph_cross' }
    },
    {
        id: 'wild',
        title: 'Wild Run',
        shortDescription: 'Chaos lab: joker matching, sticky fingers, short memorize, and dense pickups for power discovery.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Wild Run and shows wild matching.',
            testId: 'hud-mode-identity'
        },
        identityTag: 'Chaos lab',
        promise: 'Experiment with volatile tools and wild matching; expect swingy floors and fast discoveries.',
        eligibilityNote: 'Practice-adjacent chaos run; perfect-memory style achievements are blocked by wild/power use, but local run stats still record.',
        outcomeSummary: 'Wild results highlight volatile mutators, joker matching, and discovery.',
        challengeGateId: 'wild_entry',
        challengeGateSummary: 'Unlocked after reaching floor 5 or earning First Clear; surfaced as practice-adjacent.',
        group: 'training',
        availability: 'available',
        posterKey: 'wild',
        action: { type: 'startWildRun' }
    },
    {
        id: 'practice',
        title: 'Practice',
        shortDescription: 'Low-pressure lab for learning powers, tiles, and routes without chasing mastery rewards.',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Practice and achievements are disabled.',
            testId: 'hud-mode-identity'
        },
        promise: 'Learn and test — a safe place to rehearse the core loop.',
        eligibilityNote: 'Practice disables achievements so experimentation cannot pollute mastery runs.',
        group: 'training',
        availability: 'available',
        posterKey: 'practice',
        action: { type: 'startPracticeRun' }
    },
    {
        id: 'scholar',
        title: 'Scholar',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Scholar Contract.',
            testId: 'hud-mode-identity'
        },
        shortDescription: 'Mastery contract: no shuffle, no destroy — prove the read without damage-control tools.',
        promise: 'Purist memory — planning and recall over rescue buttons.',
        eligibilityNote: 'Achievements remain eligible; the contract also grants an extra relic choice at shrines.',
        challengeGateId: 'scholar_entry',
        challengeGateSummary: 'Unlocked after first clear; contract stays local and non-online.',
        group: 'training',
        availability: 'available',
        posterKey: 'scholar',
        action: { type: 'startScholarContractRun' }
    },
    {
        id: 'pin_vow',
        title: 'Pin vow',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Pin vow and shows the pin cap.',
            testId: 'hud-mode-identity'
        },
        shortDescription: 'Planning constraint: only ten pin placements across the run, so every mark matters.',
        promise: 'Precise planning — spend marks intentionally and preserve spatial memory.',
        eligibilityNote: 'Achievements remain eligible; pins are Perfect Memory-safe, but the placement cap is strict.',
        challengeGateId: 'pin_vow_entry',
        challengeGateSummary: 'Unlocked after best no-powers floor 5 or first clear; strict local pin cap.',
        group: 'training',
        availability: 'available',
        posterKey: 'pin_vow',
        action: { type: 'startPinVowRun' }
    },
    {
        id: 'meditation',
        title: 'Meditation',
        startContract: {
            label: 'Start signal',
            signal: 'HUD mode reads Meditation Run.',
            testId: 'hud-mode-identity'
        },
        shortDescription: 'Comfort practice: calmer pacing, longer memorize windows, and optional focused mutator study.',
        identityTag: 'Calm practice',
        promise: 'Focused comfort — study patterns without the usual pressure spike.',
        eligibilityNote: 'Achievements remain eligible when rules allow, but Meditation is positioned as practice/comfort first.',
        outcomeSummary: 'Meditation results emphasize comfort practice and focused study.',
        group: 'training',
        availability: 'available',
        posterKey: 'meditation',
        action: { type: 'meditationSetup' }
    }
] as const;

export function runModesByGroup(group: RunModeGroup): readonly RunModeDefinition[] {
    return RUN_MODE_CATALOG.filter((def) => def.group === group);
}

/** Featured hero row on Choose Your Path. Order is fixed; Dungeon Showcase is first for portfolio demos. */
export const CHOOSE_PATH_HERO_MODE_IDS = ['dungeon_showcase', 'classic', 'daily', 'endless'] as const;
export type ChoosePathHeroModeId = (typeof CHOOSE_PATH_HERO_MODE_IDS)[number];

const CHOOSE_PATH_HERO_ID_SET = new Set<string>(CHOOSE_PATH_HERO_MODE_IDS);

export function choosePathHeroModes(): readonly RunModeDefinition[] {
    return CHOOSE_PATH_HERO_MODE_IDS.map((id) => {
        const def = RUN_MODE_CATALOG.find((m) => m.id === id);
        if (!def) {
            throw new Error(`choosePathHeroModes: missing catalog entry for id "${id}"`);
        }
        return def;
    });
}

/** All modes below the hero row (Gauntlet, puzzles, training), stable catalog order. */
export function choosePathLibraryModes(): readonly RunModeDefinition[] {
    return RUN_MODE_CATALOG.filter((m) => !CHOOSE_PATH_HERO_ID_SET.has(m.id));
}

export { getChallengeModeProgressionRows as getRunModeChallengeGateRows } from './challenge-progression';
