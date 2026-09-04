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
    noSearchResults: 'No modes match this search.'
} as const;

export const GAME_OVER_LABELS = {
    playAgainMobile: 'Mobile Play Again - start a new run after this expedition',
    region: 'Run result and next actions',
    returnToMenuMobile: 'Mobile return to the main menu'
} as const;

export const SHOP_COPY = {
    emptyState: 'The vendor has nothing left this visit.',
    /** The side-room vendor, which does not advance the floor. */
    sideRoomSubtitle: 'Spend current shop gold, then return to the board. This vendor does not advance the floor.',
    subtitle: 'Spend temporary shop gold before the next floor. Unspent gold expires when the run ends.'
} as const;
