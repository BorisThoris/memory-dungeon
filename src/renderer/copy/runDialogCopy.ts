/**
 * The in-run dialogs and the board's own status lines.
 *
 * Abandon copy in particular is worth having in one place: it is the only screen in the game that
 * destroys progress, so the sentence explaining that has to stay blunt through translation.
 */
export const PAUSE_DIALOG_COPY = {
    subtitle: 'The board and its timers stay frozen. Press P to resume.',
    /** A finger has no P key; the shell picks this line when its input is touch. */
    subtitleTouch: 'The board and its timers stay frozen.'
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

/**
 * The par stat in the head, and the turns the run has left beside it.
 *
 * Gen 183 took the lives away and put the pressure on the turn ceiling (`docs/REMOVED_LIVES.md`),
 * but only a screen reader was ever told where that ceiling was: the head read `4 of 7 turns` and
 * nothing on it said the run ends at 21. What a row of hearts did well was show how much was
 * left, not how much had been spent, so the budget is back on the rule as a count that falls -
 * type on the same line as the par, not a boxed meter, and red on the same two-turn edge the par
 * already marks.
 */
export const RUN_SHELL_PAR_COPY = {
    /** `4 of 9 turns, 2 misses left` - or, with the bank empty, `4 of 9 turns, no misses left`. */
    aria: (turnsTaken: number, parTurns: number, missesLeft: number | null): string =>
        missesLeft == null
            ? `${turnsTaken} of ${parTurns} turns`
            : `${turnsTaken} of ${parTurns} turns, ${missesLeft === 0 ? 'no' : missesLeft} ${missesLeft === 1 ? 'miss' : 'misses'} left`,
    /** The word after the count. Short, because it sits in a head that a phone also has to hold. */
    leftWord: (missesLeft: number): string => (missesLeft === 1 ? 'miss left' : 'misses left'),
    /** On hover, where there is room to say which rule the count belongs to. */
    title: 'Misses you can still make. A miss with none left ends the run; each new floor gives one back, up to three.'
} as const;

/** Spoken by screen readers over the run shell's pause control. */
export const RUN_SHELL_LABELS = {
    pause: 'Pause and open the run menu',
    /** The purse on the head, and what it is for on hover. */
    gold: 'gold',
    goldTitle: 'Gold: earned when a floor clears, spent in the store on the pause menu.',
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
    },
    fit: {
        available: 'Bring the whole board back on screen',
        atRest: 'The board already fits the screen'
    }
} as const;

/**
 * The caption under the board: a kicker naming the moment, then the run line under it. The
 * kicker is the standing the sentence is read from — which chain, which rung — so a line about a
 * pickup or a miss still says where the run is.
 */
export const RUN_SHELL_LINE_COPY = {
    chainKicker: (chain: number, tierLabel: string): string =>
        chain <= 0 ? 'No chain' : tierLabel ? `Chain ${chain} · ${tierLabel}` : `Chain ${chain}`,
    firstFloorKicker: 'First floor',
    missKicker: 'No match',
    /** `6 pairs. Every face shows for 4 seconds; then the floor begins.` */
    study: (pairs: number, seconds: number): string =>
        `${pairs} ${pairs === 1 ? 'pair' : 'pairs'}. Every face shows for ${seconds} ${
            seconds === 1 ? 'second' : 'seconds'
        }; then the floor begins.`,
    studyKicker: 'Study the board'
} as const;

/**
 * The study period ends itself on a clock. This is the line that tells the player they can end
 * it themselves, and the label the same control carries for a screen reader.
 *
 * Both name the payout, because the gesture reads as pure subtraction without it: a player told
 * only that they can give up clock has been offered less of something, and will not press it
 * twice. What they are actually offered is a trade, so the line says so.
 */
export const MEMORIZE_SKIP_COPY = {
    hint: 'Double-tap the board to start early and bank momentum',
    label: 'Start the floor early and bank chain momentum'
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
