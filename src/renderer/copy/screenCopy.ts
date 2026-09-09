/**
 * Prose belonging to a whole screen: what it is for, and what it says when it is empty.
 *
 * The screen-reader labels live here too. They are as player-facing as anything drawn on screen —
 * for anyone using one they are the only text there is — so they translate along with the rest
 * rather than being left behind in the markup.
 */
export const CHOOSE_YOUR_PATH_COPY = {
    dungeonBlurb: 'A clean descent: procedural floors of pairs, clumps, and chains.',
    guidedBlurb:
        'Start with a guided first room: match the marked pair, clear the floor, then choose what the next room changes.',
    /** The "no group picked" chip on the library's group filter. */
    groupFilterAll: 'All',
    /* Not "Filter modes ...": the search box owns that label, and two of them make both ambiguous. */
    groupFilterLabel: 'Narrow by kind',
    /** Prefix for the live countdown to the next UTC daily. */
    mutatorsSubtitle: 'Toggle mutators for a focused study run, or start calm with a clean ruleset.',
    /** `4 of 12 modes` under the library's filters. Counts are substituted by the screen. */
    modeCount: (shown: number, total: number): string => `${shown} of ${total} modes`,
    noSearchResults: 'No modes match this search.',
    /** Pasting a run someone else played. */
    sharedRunLabel: 'Play a shared run',
    sharedRunPlaceholder: 'Paste a run key',
    sharedRunPlay: 'Play it',
    sharedRunUnreadable: 'That is not a run key.'
} as const;

export const CODEX_SCREEN_COPY = {
    demoSubtitle: 'Demo build: Act I mutators are in play.',
    subtitle: (version: string | number): string =>
        `Everything the run can put in front of you, in the words the run uses. Version ${version}.`
} as const;

export const GAME_OVER_LABELS = {
    playAgainMobile: 'Mobile Play Again - start a new run after this expedition',
    region: 'Run result and next actions',
    returnToMenuMobile: 'Mobile return to the main menu'
} as const;

/**
 * The Classic setup sheet: how this run should be played, asked once, in front of the run.
 *
 * These lines replaced eight menu cards. They are written as choices about a run rather than as
 * names of modes, because that is what they are — the player is not picking a different game, they
 * are saying how hard they want this one to be.
 */
export const CLASSIC_SETUP_COPY = {
    title: 'Set up your run',
    subtitle: 'Everything here is optional. Start plays the plain descent.',
    vowsLabel: 'Vows',
    vowsHint: 'Self-imposed restrictions. Harder, and yours to choose.',
    scholarLabel: 'Scholar: no shuffle, no destroy',
    pinVowLabel: 'Pin vow: ten pins for the whole run',
    pacingLabel: 'Pacing',
    calmLabel: 'Calm: slower resolves',
    pressureLabel: 'Clock',
    noClockLabel: 'No clock',
    chaosLabel: 'Wild: a joker tile and a chaotic floor set',
    unrecordedLabel: 'Do not record this run',
    startLabel: 'Start run',
    cancelLabel: 'Cancel'
} as const;
