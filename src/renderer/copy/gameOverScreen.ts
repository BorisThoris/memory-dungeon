import type { RunEndReason, RunSummary } from '../../shared/contracts';

/**
 * User-visible strings for the post-run summary (GameOverScreen). Centralized for a11y review and future i18n.
 */
export const gameOverScreenCopy = {
    heroEyebrow: 'Run complete',
    heroTitle: 'Expedition Over',
    scoreLabel: 'Score',
    floorCaption: (highestLevel: number) =>
        `Floor ${highestLevel} reached before the archive sealed.`,
    politeRunSummary: (totalScore: number, highestLevel: number) =>
        `Expedition complete. Final score ${totalScore.toLocaleString()}. Highest floor ${highestLevel}.`,
    achievementsNoteOn: 'Achievements counted for this run.',
    /**
     * Why achievements did not count, in the run's own terms.
     *
     * There used to be one line for this — "Achievements were off (debug tools used)" — and three
     * ways to turn them off. A practice run has said the player used debug tools since practice
     * shipped; a shared game said it too. Naming the reason costs one function and stops the
     * results screen telling a player something that did not happen.
     */
    achievementsNoteOff: 'Achievements were off (debug tools used).',
    achievementsNoteOffShared: 'Achievements are off in a shared game.',
    achievementsNoteOffPractice: 'Achievements are off in practice.',
    actionKicker: 'Next move',
    actionHeading: 'Continue the archive',
    playAgainLabel: 'Play Again',
    playAgainAriaLabel: 'Play Again - start a new run after this expedition',
    /* Thesis §56.3: the same board again. Nothing granted, the record stands; you know it now. */
    rematchLabel: 'Rematch this board',
    rematchAriaLabel: 'Rematch - play this exact board again, same layout and rules',
    mainMenuLabel: 'Main Menu',
    mainMenuAriaLabel: 'Return to the main menu',
    /**
     * Copying the result is an action, not another restatement of the score: it hands the run to
     * somebody else, seed and all.
     */
    copyResultLabel: 'Copy result',
    copyResultAriaLabel: 'Copy this run, seed and all, so someone else can play it',
    copyResultDone: 'Copied',
    copyResultFailed: 'Could not copy',
    /** The one moment a score-chasing game owes the player a sentence. */
    personalBestBeaten: 'New personal best',
    personalBestMatched: 'Matched your personal best',
    runSnapshotKicker: 'Run snapshot',
    statLabels: {
        highestFloor: 'Highest Floor',
        bestStreak: 'Best Streak',
        perfectFloors: 'Perfect Floors',
        /* Thesis §55.2: the largest single break is "the one players will screenshot". It took the
           tile "Floors Cleared" held, which the floor headline already says. */
        largestBreak: 'Largest Break',
        bestScore: 'Best Score'
    },
    /** The largest break's tile value: pairs, because that is the number a screenshot shows. */
    largestBreakValue: (pairs: number): string =>
        pairs <= 0 ? 'None yet' : pairs === 1 ? '1 pair' : `${pairs} pairs`,
    runModeHeadings: {
        daily: (dateKey: string) => `Daily ${dateKey}`,
        meditation: 'Meditation descent',
        puzzle: 'Puzzle descent',
        scholar: 'Scholar contract',
        pinVow: 'Pin vow descent',
        wild: 'Wild run',
        practice: 'Practice descent',
        classic: 'Classic descent'
    },
    modeIdentity: {
        meditation: 'Focused comfort: calmer memorize pacing for study and mutator practice.',
        puzzle: 'Curated challenge: fixed board and local completion tracking.',
        daily: 'Shared UTC seed: local-only comparison, no online leaderboard.',
        scholar: 'Scholar contract: no full-board shuffle, stricter memory proof, and contract rewards.',
        pinVow: 'Pin vow: route planning mattered because pinned notes were capped across the run.',
        wild: 'Wild Run: joker-style matching pressure stayed attached through the final summary.',
        practice: 'Practice descent: training rules were explicit, with progression expectations reduced.',
        /* Every run summary opens with this line; the old "Long-run core: chains and featured
           objectives" was the design's name for the mode, not something said to a player. */
        classic: 'Classic descent: chain matches, keep a miss in the bank, and go as deep as you can.'
    },
    flipHistoryCopy: (flipCount: number) =>
        flipCount > 0
            ? `${flipCount} flips recorded locally for this session.`
            : 'No flip history stored for this run.',
    achievementEyebrow: 'Unlocked',
    achievementHeading: 'New archive entries',
    flipTimelineSummary: 'Flip timeline',
    /**
     * How the run ended, one line under the score. A run ends two ways (thesis §42.2): the player
     * stops, or a floor is still open at its turn ceiling. A contract's mismatch limit and a shared
     * game's last floor are the other two exits the rules have. None of them is a verdict on the
     * player - the ceiling line names the rule, not a failure.
     */
    endReason: {
        turn_ceiling: (floor: number) => `Your turns ran out on floor ${floor}.`,
        miss_budget: (floor: number) => `You ran out of misses on floor ${floor}.`,
        quit: (floor: number) => `You stopped on floor ${floor}.`,
        contract: (floor: number) => `The contract's mismatch limit ended the run on floor ${floor}.`,
        pass_and_play_final_floor: (floor: number) => `The table played its last floor, floor ${floor}.`
    } satisfies Record<RunEndReason, (floor: number) => string>
} as const;

/**
 * The end-reason line for a summary, or nothing for one that predates the reason being recorded:
 * an older summary reads as unknown rather than as any one of the four.
 */
export const runEndReasonLine = (summary: Pick<RunSummary, 'highestLevel' | 'runEndReason'>): string | null =>
    summary.runEndReason ? gameOverScreenCopy.endReason[summary.runEndReason](summary.highestLevel) : null;

/**
 * The achievements line for a run, picked by the reason they were off rather than by assuming one.
 * Order matters only in that a shared game is the strongest claim: it is the one the mode's card
 * already made to the table before they started.
 */
export const achievementsNote = ({
    achievementsEnabled,
    practiceMode,
    sharedTable
}: {
    achievementsEnabled: boolean;
    practiceMode?: boolean;
    sharedTable?: boolean;
}): string => {
    if (achievementsEnabled) {
        return gameOverScreenCopy.achievementsNoteOn;
    }
    if (sharedTable === true) {
        return gameOverScreenCopy.achievementsNoteOffShared;
    }
    if (practiceMode === true) {
        return gameOverScreenCopy.achievementsNoteOffPractice;
    }
    return gameOverScreenCopy.achievementsNoteOff;
};
