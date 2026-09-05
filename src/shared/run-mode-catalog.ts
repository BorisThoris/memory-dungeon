import { isModeAvailableInBuild } from './content-lock-state';
import { PASS_AND_PLAY_FLOORS } from './pass-and-play-rules';
/**
 * Product-facing run mode catalog for Choose Your Path (ordered, stable ids).
 * Kept separate from `GameMode` in contracts — entries may share an underlying mode with flags.
 */

export type RunModeGroup = 'core' | 'puzzle';

export type RunModeAvailability = 'available' | 'locked' | 'disabled';

/** Discriminated actions — no store imports; renderer maps these to `useAppStore` methods. */
export type PuzzleRunModeId = 'starter_pairs' | 'mirror_craft' | 'glyph_cross';

export type RunModeAction =
    /** Opens the Classic setup, where the retired preset cards now live as choices. */
    | { type: 'startRun' }
    | { type: 'startDailyRun' }
    | { type: 'locked' }
    | { type: 'puzzle'; puzzleId: PuzzleRunModeId }
    | { type: 'startPassAndPlayRun'; seats: number };

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
    group: RunModeGroup;
    availability: RunModeAvailability;
    /** Key into mode poster map (`modeArt.ts`). */
    posterKey: string;
    /** Optional stable selector for automation. */
    testId?: string;
    action: RunModeAction;
}

/**
 * Eyebrow / section order on Choose Your Path. Only the groups that still hold a mode: time attack and training became
 * Classic setup options.
 */
export const RUN_MODE_GROUP_ORDER: readonly RunModeGroup[] = ['core', 'puzzle'] as const;

export const RUN_MODE_GROUP_LABEL: Record<RunModeGroup, string> = {
    core: 'Core modes',
    puzzle: 'Puzzle'
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
        group: 'core',
        availability: 'available',
        posterKey: 'daily',
        action: { type: 'startDailyRun' }
    },
    {
        id: 'pass_and_play',
        title: 'Pass and Play',
        shortDescription:
            `Two to four people, one device, ${PASS_AND_PLAY_FLOORS} floors. Find a pair and you go again; miss and it is the next player\u2019s turn.`,
        startContract: {
            label: 'Start signal',
            signal: 'The HUD shows a score per player and says whose turn it is.',
            testId: 'hud-pass-and-play'
        },
        identityTag: 'Same device',
        promise:
            'The dungeon everyone already knows, played around one screen \u2014 the rule is the one every table already knows.',
        eligibilityNote:
            'A shared game does not set your personal best or write a run to your history: the score on screen belongs to the table, not to this save.',
        outcomeSummary: `Everyone plays the same ${PASS_AND_PLAY_FLOORS} floors; the higher score wins, and a draw is reported as a draw.`,
        availabilityDetail:
            'Offline and local. It needs no account, no second device, and nothing online \u2014 the same board, taking turns.',
        group: 'core',
        availability: 'available',
        posterKey: 'pass_and_play',
        testId: 'mode-pass-and-play',
        action: { type: 'startPassAndPlayRun', seats: 2 }
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
        group: 'puzzle',
        availability: 'available',
        posterKey: 'puzzle',
        action: { type: 'puzzle', puzzleId: 'glyph_cross' }
    },
] as const;

/** A catalog mode as this build flavour ships it: locked modes stay visible and say why. */
export const applyContentLockToRunMode = (mode: RunModeDefinition): RunModeDefinition =>
    mode.availability === 'available' && !isModeAvailableInBuild(mode.id)
        ? { ...mode, availability: 'locked', availabilityDetail: 'In the full game.' }
        : mode;

/** The catalog as the active build flavour ships it. Read modes through this, not RUN_MODE_CATALOG. */
export function getRunModeCatalog(): readonly RunModeDefinition[] {
    return RUN_MODE_CATALOG.map(applyContentLockToRunMode);
}

export function runModesByGroup(group: RunModeGroup): readonly RunModeDefinition[] {
    return getRunModeCatalog().filter((def) => def.group === group);
}

export function getRunModeDefinition(id: string): RunModeDefinition | null {
    return getRunModeCatalog().find((mode) => mode.id === id) ?? null;
}

/**
 * Featured hero row on Choose Your Path. Classic leads because it is the game; the other two are
 * the only entries that differ in kind rather than in settings — the same board for everyone that
 * day, and the same board for everyone at the table.
 */
export const CHOOSE_PATH_HERO_MODE_IDS = ['classic', 'daily', 'pass_and_play'] as const;
export type ChoosePathHeroModeId = (typeof CHOOSE_PATH_HERO_MODE_IDS)[number];

const CHOOSE_PATH_HERO_ID_SET = new Set<string>(CHOOSE_PATH_HERO_MODE_IDS);

export function choosePathHeroModes(): readonly RunModeDefinition[] {
    return CHOOSE_PATH_HERO_MODE_IDS.map((id) => {
        const def = getRunModeDefinition(id);
        if (!def) {
            throw new Error(`choosePathHeroModes: missing catalog entry for id "${id}"`);
        }
        return def;
    });
}

/** All modes below the hero row (the authored puzzles), stable catalog order. */
export function choosePathLibraryModes(): readonly RunModeDefinition[] {
    return getRunModeCatalog().filter((m) => !CHOOSE_PATH_HERO_ID_SET.has(m.id));
}

export { getChallengeModeProgressionRows as getRunModeChallengeGateRows } from './challenge-progression';
