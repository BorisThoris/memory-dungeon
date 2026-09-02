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
    achievementsNoteOff: 'Achievements were off (debug tools used).',
    actionKicker: 'Next move',
    actionHeading: 'Continue the archive',
    playAgainLabel: 'Play Again',
    playAgainAriaLabel: 'Play Again - start a new run after this expedition',
    mainMenuLabel: 'Main Menu',
    mainMenuAriaLabel: 'Return to the main menu',
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
