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
    achievementsNoteOffShowcase: 'Achievements are off in the showcase.',
    actionKicker: 'Next move',
    actionHeading: 'Continue the archive',
    playAgainLabel: 'Play Again',
    playAgainAriaLabel: 'Play Again - start a new run after this expedition',
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
        floorsCleared: 'Floors Cleared',
        bestScore: 'Best Score'
    },
    runModeHeadings: {
        daily: (dateKey: string) => `Daily ${dateKey}`,
        gauntlet: 'Gauntlet descent',
        meditation: 'Meditation descent',
        puzzle: 'Puzzle descent',
        scholar: 'Scholar contract',
        pinVow: 'Pin vow descent',
        wild: 'Wild run',
        practice: 'Practice descent',
        dungeonShowcase: 'Dungeon Showcase',
        classic: 'Classic descent'
    },
    modeIdentity: {
        gauntlet: 'Timed pressure: achievements still count, but the wall-clock can end the run.',
        meditation: 'Focused comfort: calmer memorize pacing for study and mutator practice.',
        puzzle: 'Curated challenge: fixed board and local completion tracking.',
        daily: 'Shared UTC seed: local-only comparison, no online leaderboard.',
        scholar: 'Scholar contract: no full-board shuffle, stricter memory proof, and contract rewards.',
        pinVow: 'Pin vow: route planning mattered because pinned notes were capped across the run.',
        wild: 'Wild Run: joker-style matching pressure stayed attached through the final summary.',
        practice: 'Practice descent: training rules were explicit, with progression expectations reduced.',
        dungeonShowcase: 'Dungeon Showcase: wide-recall route pressure and dungeon systems were the featured contract.',
        classic: 'Long-run core: routes, shop gold, relics, and featured objectives.'
    },
    flipHistoryCopy: (flipCount: number) =>
        flipCount > 0
            ? `${flipCount} flips recorded locally for this session.`
            : 'No flip history stored for this run.',
    achievementEyebrow: 'Unlocked',
    achievementHeading: 'New archive entries',
    flipTimelineSummary: 'Flip timeline'
} as const;

/**
 * The achievements line for a run, picked by the reason they were off rather than by assuming one.
 * Order matters only in that a shared game is the strongest claim: it is the one the mode's card
 * already made to the table before they started.
 */
export const achievementsNote = ({
    achievementsEnabled,
    dungeonShowcaseRun,
    practiceMode,
    sharedTable
}: {
    achievementsEnabled: boolean;
    dungeonShowcaseRun?: boolean;
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
    if (dungeonShowcaseRun === true) {
        return gameOverScreenCopy.achievementsNoteOffShowcase;
    }
    return gameOverScreenCopy.achievementsNoteOff;
};
