import { isModeAvailableInBuild } from './content-lock-state';
import { PASS_AND_PLAY_FLOORS } from './pass-and-play-rules';
/**
 * Product-facing run mode catalog for Choose Your Path (ordered, stable ids).
 * Kept separate from `GameMode` in contracts — entries may share an underlying mode with flags.
 */

export type RunModeGroup = 'core';

export type RunModeAvailability = 'available' | 'locked' | 'disabled';

/** Discriminated actions — no store imports; renderer maps these to `useAppStore` methods. */
export type RunModeAction =
    /** Opens the Classic setup, where the retired preset cards now live as choices. */
    | { type: 'startRun' }
    | { type: 'locked' }
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
 * Eyebrow / section order on Choose Your Path. One group holds every entry now: time attack and
 * training became Classic setup options, and the daily and the authored puzzles went with the mode
 * collapse (`docs/REMOVED_MODES.md`).
 */
export const RUN_MODE_GROUP_ORDER: readonly RunModeGroup[] = ['core'] as const;

export const RUN_MODE_GROUP_LABEL: Record<RunModeGroup, string> = {
    core: 'Core modes'
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
 * Featured hero row on Choose Your Path.
 *
 * Classic alone, because it is the game. It used to share the row with the daily and the table;
 * the daily went with the mode collapse, and putting the table up there too would leave the browse
 * grid below it empty — a section header over nothing. Pass and Play stays in the library, which
 * is where a player goes looking for something other than the run in front of them.
 */
export const CHOOSE_PATH_HERO_MODE_IDS = ['classic'] as const;
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

/** Anything the hero row does not carry, in stable catalog order. Empty while it carries both. */
export function choosePathLibraryModes(): readonly RunModeDefinition[] {
    return getRunModeCatalog().filter((m) => !CHOOSE_PATH_HERO_ID_SET.has(m.id));
}

export { getChallengeModeProgressionRows as getRunModeChallengeGateRows } from './challenge-progression';
