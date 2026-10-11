/**
 * Prose belonging to a whole screen: what it is for, and what it says when it is empty.
 *
 * The screen-reader labels live here too. They are as player-facing as anything drawn on screen —
 * for anyone using one they are the only text there is — so they translate along with the rest
 * rather than being left behind in the markup.
 */
export const CHOOSE_YOUR_PATH_COPY = {
    dungeonBlurb: 'Match pairs. Set off cascades. Clear each floor before you run out of turns.',
    guidedBlurb:
        'A memory game with chain reactions. Your first floor shows you how.',
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
        `Rules reference · v${version}`
} as const;

export const GAME_OVER_LABELS = {
    playAgainMobile: 'Mobile Play Again - start a new run after this expedition',
    region: 'Run result and next actions',
    returnToMenuMobile: 'Mobile return to the main menu'
} as const;

export const GLOBAL_RECORD_COPY = {
    label: 'Global high score',
    holder: (name: string, score: string): string => `Dungeon Master · ${name} · ${score}`,
    offline: 'Dungeon Master · Record offline',
    first: 'Dungeon Master · Claim the first record',
    loading: 'Dungeon Master · Loading…',
    title: 'New global high score',
    savedTitle: 'The global record is yours',
    beatenTitle: 'A new score just arrived',
    subtitle: 'One record. Everyone plays for it.',
    savedSubtitle: 'Your name is now on the record.',
    beatenSubtitle: 'Another player reached the record before yours was saved.',
    continue: 'Continue',
    claim: 'Claim global record',
    saving: 'Saving…',
    skip: 'Not now',
    name: 'Your name',
    help: 'Up to 16 characters, with at least two letters. This name will be public.',
    previous: (name: string, score: string): string => `Record to beat: ${name} · ${score}`,
    current: (name: string, score: string): string => `Global record: ${name} · ${score}`,
    failed: 'Could not save. Please try again.'
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
    subtitle: 'Optional challenges and pacing.',
    vowsLabel: 'Vows',
    vowsHint: 'Extra restrictions.',
    scholarLabel: 'Scholar: no shuffle, no destroy',
    pinVowLabel: 'Pin vow: ten pins for the whole run',
    pacingLabel: 'Pacing',
    calmLabel: 'Calm: slower resolves',
    chaosLabel: 'Wild: a joker tile and a chaotic floor set',
    unrecordedLabel: 'Do not record this run',
    startLabel: 'Start run',
    cancelLabel: 'Cancel'
} as const;
