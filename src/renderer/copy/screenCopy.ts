import { tr } from '../../shared/i18n';
/**
 * Prose belonging to a whole screen: what it is for, and what it says when it is empty.
 *
 * The screen-reader labels live here too. They are as player-facing as anything drawn on screen —
 * for anyone using one they are the only text there is — so they translate along with the rest
 * rather than being left behind in the markup.
 */
export const CHOOSE_YOUR_PATH_COPY = {
    dungeonBlurb: tr.s('Match pairs. Set off cascades. Clear each floor before you run out of turns.'),
    guidedBlurb:
        tr.s('A memory game with chain reactions. Your first floor shows you how.'),
    /** The "no group picked" chip on the library's group filter. */
    groupFilterAll: tr.s('All'),
    /* Not "Filter modes ...": the search box owns that label, and two of them make both ambiguous. */
    groupFilterLabel: tr.s('Narrow by kind'),
    /** Prefix for the live countdown to the next UTC daily. */
    mutatorsSubtitle: tr.s('Toggle mutators for a focused study run, or start calm with a clean ruleset.'),
    /** `4 of 12 modes` under the library's filters. Counts are substituted by the screen. */
    modeCount: (shown: number, total: number): string => tr`${shown} of ${total} modes`,
    noSearchResults: tr.s('No modes match this search.'),
    /** Pasting a run someone else played. */
    sharedRunLabel: tr.s('Play a shared run'),
    sharedRunPlaceholder: tr.s('Paste a run key'),
    sharedRunPlay: tr.s('Play it'),
    sharedRunUnreadable: tr.s('That is not a run key.')
} as const;

export const CODEX_SCREEN_COPY = {
    demoSubtitle: tr.s('Demo build: Act I mutators are in play.'),
    subtitle: (version: string | number): string =>
        tr`Rules reference · v${version}`
} as const;

export const GAME_OVER_LABELS = {
    playAgainMobile: tr.s('Mobile Play Again - start a new run after this expedition'),
    region: tr.s('Run result and next actions'),
    returnToMenuMobile: tr.s('Mobile return to the main menu')
} as const;

export const GLOBAL_RECORD_COPY = {
    label: tr.s('Global high score'),
    rank: tr.s('Dungeon Master'),
    points: tr.s('World record'),
    challenge: tr.s('Take the crown'),
    challengeHint: tr.s('Beat this score. Your name takes the throne.'),
    offline: tr.s('Record unavailable'),
    offlineHint: tr.s('The dungeon awaits. The record will return when connected.'),
    first: tr.s('The throne is unclaimed'),
    firstHint: tr.s('Set the first record. Become the Dungeon Master.'),
    loading: tr.s('Seeking the champion…'),
    loadingHint: tr.s('One throne. The highest score holds it.'),
    title: tr.s('New global high score'),
    savedTitle: tr.s('The global record is yours'),
    beatenTitle: tr.s('A new score just arrived'),
    subtitle: tr.s('One record. Everyone plays for it.'),
    savedSubtitle: tr.s('Your name is now on the record.'),
    beatenSubtitle: tr.s('Another player reached the record before yours was saved.'),
    continue: tr.s('Continue'),
    claim: tr.s('Claim global record'),
    saving: tr.s('Saving…'),
    skip: tr.s('Not now'),
    name: tr.s('Your name'),
    help: tr.s('Up to 16 characters, with at least two letters. This name will be public.'),
    previous: (name: string, score: string): string => tr`Record to beat: ${name} · ${score}`,
    current: (name: string, score: string): string => tr`Global record: ${name} · ${score}`,
    failed: tr.s('Could not save. Please try again.')
} as const;

/**
 * The Classic setup sheet: how this run should be played, asked once, in front of the run.
 *
 * These lines replaced eight menu cards. They are written as choices about a run rather than as
 * names of modes, because that is what they are — the player is not picking a different game, they
 * are saying how hard they want this one to be.
 */
export const CLASSIC_SETUP_COPY = {
    campLabel: tr.s('Automatic camp spending'),
    campHint: tr.s('One reward every 3 floors. Default keeps the current balanced policy.'),
    campDefault: tr.s('Default · balanced'),
    campSurvive: tr.s('Survive · misses, capacity, bombs'),
    campStudy: tr.s('Study · study time, peeks'),
    campScore: tr.s('Score · combo gold'),
    campEvolve: tr.s('Evolve · the relics your blueprints ask for'),
    depthLabel: tr.s('Depth'),
    depthHint: tr.s('Every rung up to the Depth you pick is in play. Fell the Warden to open the next.'),
    /** The ladder, opened already lit (DGE-004's banked progress): the Warden you felled opened the first rung. */
    depthLadder: (open: number, of: number): string => tr`Depth ${open} of ${of} open: the Warden you felled lit the first.`,
    depthNone: tr.s('Depth 0 · the Descent as it is'),
    depthOption: (depth: number, name: string): string => tr`Depth ${depth} · ${name}`,
    title: tr.s('Set up your run'),
    subtitle: tr.s('Optional challenges and pacing.'),
    vowsLabel: tr.s('Vows'),
    vowsHint: tr.s('Extra restrictions.'),
    scholarLabel: tr.s('Scholar: no shuffle, no destroy'),
    pinVowLabel: tr.s('Pin vow: ten pins for the whole run'),
    pacingLabel: tr.s('Pacing'),
    calmLabel: tr.s('Calm: slower resolves'),
    chaosLabel: tr.s('Wild: a joker tile and a chaotic floor set'),
    unrecordedLabel: tr.s('Do not record this run'),
    startLabel: tr.s('Start run'),
    cancelLabel: tr.s('Cancel')
} as const;
