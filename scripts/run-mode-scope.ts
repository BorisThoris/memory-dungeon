import { getRunModeCatalog } from '../src/shared/run-mode-catalog';

/**
 * Which entries in the mode catalog are their own game, and which are Classic with a knob turned.
 *
 * The catalog grew to twelve entries. Reading what each one actually starts, eleven of them call
 * `createNewRun` with an option bag: Wild is three mutators and a joker, Scholar and Pin Vow are
 * contracts, Practice is a boolean, Meditation is pacing, Gauntlet is a timer, Endless is Classic
 * with the length turned up, and Dungeon Showcase is a staged board for showing the game off. Only
 * the handcrafted Puzzles build a different board, only Daily fixes the seed for everyone, and only
 * Pass and Play changes who is holding the device.
 *
 * A menu of twelve is not twelve games; it is one game asked twelve ways, and it costs the player
 * the decision every single time they sit down. The premium dungeon crawlers this game is aimed at
 * ship one deep run and put the variations inside it, where they read as choices about *this* run
 * rather than as a fork in the road before it starts.
 *
 * So: `distinct` entries stay on Choose Your Path. `preset` entries are Classic under another name
 * and belong inside a Classic run's setup, not beside it. Nothing here deletes a rule — a preset's
 * options are exactly as playable, and this module is the record of where they went.
 */
export type RunModeScopeKind = 'distinct' | 'preset';

export interface RunModeScopeRow {
    readonly modeId: string;
    readonly kind: RunModeScopeKind;
    /** What this entry changes about a run, in the terms the code actually uses. */
    readonly changes: string;
    /** Why that does or does not make it its own mode. */
    readonly reason: string;
}

export const RUN_MODE_SCOPE: readonly RunModeScopeRow[] = [
    {
        modeId: 'classic',
        kind: 'distinct',
        changes: 'The procedural descent itself: floors, routes, shop gold, relic milestones.',
        reason: 'The main game. Everything else is measured against it.'
    },
    {
        modeId: 'daily',
        kind: 'distinct',
        changes: 'Fixes the seed and the mutators from the UTC date, and records a streak.',
        reason: 'The same board for everyone that day is a different proposition, not a difficulty knob: it is the only mode where a score means something next to someone else’s.'
    },
    {
        modeId: 'pass_and_play',
        kind: 'distinct',
        changes: 'Seats two to four players, passes the device on a miss, ends at an agreed length.',
        reason: 'Changes who is playing rather than what the board does. Same-device multiplayer is the one thing here a solo run cannot be turned into.'
    },
    {
        modeId: 'puzzle_starter',
        kind: 'distinct',
        changes: 'Builds the board from a handcrafted tile list instead of generating one.',
        reason: 'A designed board is not a procedural board with settings; it is the one family here that is authored rather than rolled.'
    },
    {
        modeId: 'puzzle_mirror',
        kind: 'distinct',
        changes: 'Builds the board from a handcrafted tile list instead of generating one.',
        reason: 'Same as the starter puzzle: authored, not generated.'
    },
    {
        modeId: 'puzzle_glyph_cross',
        kind: 'distinct',
        changes: 'Builds the board from a handcrafted tile list instead of generating one.',
        reason: 'Same as the starter puzzle: authored, not generated.'
    },
    {
        modeId: 'endless',
        kind: 'preset',
        changes: 'Nothing yet. It has been locked since it was added, promising a longer Classic.',
        reason: 'Classic already runs until the player dies. A locked card promising the same thing at greater length is a menu entry that has never been a game.'
    },
    {
        modeId: 'dungeon_showcase',
        kind: 'preset',
        changes: 'Starts Classic on a staged dungeon floor with achievements and records off.',
        reason: 'A way to show the dungeon off, not a way to play it. Its own card says results do not count.'
    },
    {
        modeId: 'gauntlet',
        kind: 'preset',
        changes: 'Classic with a countdown that ends the run.',
        reason: 'A timer is the clearest example of a knob: the board, the floors and the rules are Classic’s throughout.'
    },
    {
        modeId: 'wild',
        kind: 'preset',
        changes: 'Classic with a joker tile, a stray-remove charge and three mutators.',
        reason: 'A mutator preset. Every part of it is something a Classic run can already carry.'
    },
    {
        modeId: 'practice',
        kind: 'preset',
        changes: 'Classic with achievements and mastery records switched off.',
        reason: 'One boolean. Whether a run counts is a property of the run, not a genre of run.'
    },
    {
        modeId: 'scholar',
        kind: 'preset',
        changes: 'Classic with a contract forbidding shuffle, swap and destroy.',
        reason: 'A self-imposed restriction, which is a choice about how to play a Classic run.'
    },
    {
        modeId: 'pin_vow',
        kind: 'preset',
        changes: 'Classic with a contract capping pins at ten for the run.',
        reason: 'Same shape as Scholar: one contract field.'
    },
    {
        modeId: 'meditation',
        kind: 'preset',
        changes: 'Classic with longer memorize windows, calmer pacing and optional focus mutators.',
        reason: 'Pacing and comfort settings. These belong to the player, not to a mode — someone who wants a longer memorize window wants it in every run they play.'
    }
] as const;

export const getRunModeScopeRows = (): readonly RunModeScopeRow[] => RUN_MODE_SCOPE;

export const getRunModeScope = (modeId: string): RunModeScopeRow | undefined =>
    RUN_MODE_SCOPE.find((row) => row.modeId === modeId);

/** True for the entries that earn a place on Choose Your Path. */
export const isDistinctRunMode = (modeId: string): boolean => getRunModeScope(modeId)?.kind === 'distinct';

/** Catalog entries this module has not classified: a new mode has to be triaged, not just added. */
export const findUnclassifiedRunModes = (): string[] =>
    getRunModeCatalog()
        .map((mode) => mode.id)
        .filter((id) => getRunModeScope(id) === undefined);

/**
 * A mode this module calls distinct that the catalog no longer offers.
 *
 * Preset rows are *expected* to be absent from the catalog — that is what retiring them meant, and
 * the row is the record of where the rules went. A distinct row going missing is the real problem:
 * it would mean a mode this module says is its own game has quietly stopped being offered.
 */
export const findStaleRunModeScopeRows = (): string[] => {
    const catalogIds = new Set(getRunModeCatalog().map((mode) => mode.id));
    return RUN_MODE_SCOPE.filter((row) => row.kind === 'distinct' && !catalogIds.has(row.modeId)).map(
        (row) => row.modeId
    );
};

/** The retired entries, kept so the decision outlives the cards it removed. */
export const getRetiredRunModeIds = (): string[] =>
    RUN_MODE_SCOPE.filter((row) => row.kind === 'preset').map((row) => row.modeId);
