/**
 * Prose belonging to a whole screen: what it is for, and what it says when it is empty.
 *
 * The screen-reader labels live here too. They are as player-facing as anything drawn on screen —
 * for anyone using one they are the only text there is — so they translate along with the rest
 * rather than being left behind in the markup.
 */
export const CHOOSE_YOUR_PATH_COPY = {
    dungeonBlurb: 'A clean dungeon descent: procedural floors, route choices, shops, and relic milestones.',
    guidedBlurb:
        'Start with a guided first room: match the marked pair, clear the floor, then choose what the next room changes.',
    /** The "no group picked" chip on the library's group filter. */
    groupFilterAll: 'All',
    /* Not "Filter modes ...": the search box owns that label, and two of them make both ambiguous. */
    groupFilterLabel: 'Narrow by kind',
    /** Prefix for the live countdown to the next UTC daily. */
    dailyResetPrefix: 'Next daily in',
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

export const GAME_OVER_LABELS = {
    playAgainMobile: 'Mobile Play Again - start a new run after this expedition',
    region: 'Run result and next actions',
    returnToMenuMobile: 'Mobile return to the main menu'
} as const;

export const SHOP_COPY = {
    emptyState: 'The vendor has nothing left this visit.',
    /*
     * The exits are named for where they go, not for the shape of the gesture. "Back" and "return"
     * mean the same thing to a player, and the alcove shipped with both on screen at once, doing
     * the same thing, one of them styled as the primary.
     */
    backToBoard: 'Back to board',
    backToFloorSummary: 'Back to floor summary',
    continue: 'Continue',
    continueToRoute: (routeLabel: string): string => `Continue to ${routeLabel} floor`,
    /** The side-room vendor, which does not advance the floor. */
    sideRoomSubtitle: 'Spend current shop gold, then return to the board. This vendor does not advance the floor.',
    subtitle: 'Spend temporary shop gold before the next floor. Unspent gold expires when the run ends.'
} as const;
