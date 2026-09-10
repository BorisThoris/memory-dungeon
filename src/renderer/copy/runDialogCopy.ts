/**
 * The in-run dialogs and the board's own status lines.
 *
 * Abandon copy in particular is worth having in one place: it is the only screen in the game that
 * destroys progress, so the sentence explaining that has to stay blunt through translation.
 */
export const PAUSE_DIALOG_COPY = {
    subtitle: 'The board and its timers stay frozen. Press P to resume.'
} as const;

export const ABANDON_DIALOG_COPY = {
    subtitle: 'You will lose this run and return to the main menu. This cannot be undone.'
} as const;

export const SHORTCUTS_COPY = {
    /** Shown on touch, where the list is a reference rather than something to press. */
    touch: 'These work while a run is active. Your keyboard still does everything it did.',
    withKeyboard: 'These shortcuts work while a run is active and when focus is not in a text field.'
} as const;

/** Lines the board shows about the floor itself rather than about a power. */
export const FLOOR_STATUS_COPY = {
    noKeySource: 'No key source remains; clear the remaining pairs to force this exit open.'
} as const;

/** The route step after a floor clears: what the three doors mean and which one moves on. */
export const ROUTE_CHOICE_COPY = {
    greedPreview: 'The next floor adds richer caches and extra reward-risk pressure.',
    mysteryPreview: 'The next floor adds deterministic mystery veils.',
    prompt: 'Choose the next room type. Safe protects the run, Greed trades danger for reward, and Mystery changes the next board.',
    safePreview: 'The next floor adds defensive ward support.',
    /** Shown once a route is locked, when the remaining actions are no longer the decision. */
    settled: 'Pick one room to continue. Route choice is the active decision; other floor-clear actions resume after the route is locked.',
    stair: 'This stair leaves the current floor.'
} as const;

/** Spoken by screen readers over the run shell's pause control. */
export const RUN_SHELL_LABELS = {
    pause: 'Pause and open the run menu',
    /** The tag on the Floor stat once this run is the deepest the profile has seen. */
    personalBest: 'Best',
    personalBestAria: 'Deepest floor yet'
} as const;

/**
 * What a dock tool says when it cannot act.
 *
 * Undo used to stay lit whatever the run was doing, and pressing it did nothing at all — no
 * arming, no message, no reason. It only works while a flipped pair is resolving, a second or so
 * per turn, so it spent almost the whole run looking available and answering to nothing.
 */
export const RUN_TOOL_REASONS = {
    undo: {
        available: 'Undo the flip being resolved',
        notResolving: 'Undo is available only while a flipped pair is resolving'
    },
    greet: {
        available: 'Say hello to whoever is on this floor',
        alreadyGreeted: 'You have already said hello on this floor',
        nobodyHome: 'There is nobody on this floor to greet'
    },
    exit: {
        available: 'Open the exit you found on this floor',
        locked: 'The exit is found, but not open yet'
    }
} as const;

/**
 * The study period ends itself on a clock. This is the line that tells the player they can end
 * it themselves, and the label the same control carries for a screen reader.
 */
export const MEMORIZE_SKIP_COPY = {
    hint: 'Double-tap the board to start early',
    label: 'Start the floor early'
} as const;

/**
 * The one achievement a player can lose by pressing a dock button. Stated on the run bar so the
 * cost is visible at the moment of the decision, not afterwards.
 */
export const PERFECT_MEMORY_COPY = {
    eligible: 'Eligible',
    label: 'Perfect memory',
    locked: 'Locked'
} as const;
