import { plural, tr } from '../../shared/i18n';
import type { RunEndReason, RunState, RunSummary } from '../../shared/contracts';
import type { DescentRunSummary } from '../../shared/descent-run-summary';
import { WARDEN_FELL_PAIRS } from '../../shared/warden-rules';
import { descentLengthFor } from '../../shared/descent-length-rules';

/**
 * User-visible strings for the post-run summary (GameOverScreen). Centralized for a11y review and future i18n.
 */
export const gameOverScreenCopy = {
    heroEyebrow: tr.s('Run complete'),
    heroTitle: tr.s('Expedition Over'),
    scoreLabel: tr.s('Score'),
    floorCaption: (highestLevel: number) =>
        tr`Floor ${highestLevel} reached before the archive sealed.`,
    /**
     * What a screen reader hears on arrival. It says how the run ended when the summary knows, the
     * one fact the screen leads with: "Expedition complete" over a run that ran out of misses was
     * the only thing a listener was told, and it was the opposite of what happened.
     */
    politeRunSummary: (totalScore: number, highestLevel: number, endReason: string | null = null) =>
        endReason
            ? tr`Run ended. ${endReason} Final score ${totalScore.toLocaleString()}.`
            : tr`Run ended. Final score ${totalScore.toLocaleString()}. Highest floor ${highestLevel}.`,
    achievementsNoteOn: tr.s('Achievements counted for this run.'),
    /** A power used takes the perfect and power-free ones away; said, so a clean floor does not seem robbed. */
    achievementsNotePowersUsed: tr.s('Achievements counted for this run, except Perfect Clear and the no-powers record: a power was used.'),
    /**
     * Why achievements did not count, in the run's own terms.
     *
     * There used to be one line for this — "Achievements were off (debug tools used)" — and three
     * ways to turn them off. A practice run has said the player used debug tools since practice
     * shipped; a shared game said it too. Naming the reason costs one function and stops the
     * results screen telling a player something that did not happen.
     */
    achievementsNoteOff: tr.s('Achievements were off (debug tools used).'),
    achievementsNoteOffShared: tr.s('Achievements are off in a shared game.'),
    achievementsNoteOffPractice: tr.s('Achievements are off in practice.'),
    achievementsNoteOffTestPace: tr.s('Achievements are off at the test pace.'),
    /** The one-time rate link (`rateGame.ts`), by the store this build can send the player to. */
    rateOnPlay: tr.s('Enjoying the Dungeon? Rate it on Google Play'),
    rateOnSteam: tr.s('Enjoying the Dungeon? Review it on Steam'),
    actionKicker: tr.s('Next move'),
    actionHeading: tr.s('Continue the archive'),
    playAgainLabel: tr.s('Play Again'),
    playAgainAriaLabel: tr.s('Play Again - start a new run after this expedition'),
    /* Thesis §56.3: the same board again. Nothing granted, the record stands; you know it now. */
    rematchLabel: tr.s('Rematch this board'),
    rematchAriaLabel: tr.s('Rematch - play this exact board again, same layout and rules'),
    mainMenuLabel: tr.s('Main Menu'),
    mainMenuAriaLabel: tr.s('Return to the main menu'),
    /* The cut-scene's last choice: the ledger of numbers, achievements and the next-run cards. */
    recordAriaLabel: tr.s('Results - see the run in numbers'),
    /**
     * Copying the result is an action, not another restatement of the score: it hands the run to
     * somebody else, seed and all.
     */
    copyResultLabel: tr.s('Copy result'),
    copyResultAriaLabel: tr.s('Copy this run, seed and all, so someone else can play it'),
    copyResultDone: tr.s('Copied'),
    copyResultFailed: tr.s('Could not copy'),
    /** The one moment a score-chasing game owes the player a sentence. */
    personalBestBeaten: tr.s('New personal best'),
    personalBestMatched: tr.s('Matched your personal best'),
    runSnapshotKicker: tr.s('Run snapshot'),
    statLabels: {
        highestFloor: tr.s('Highest Floor'),
        bestStreak: tr.s('Best Streak'),
        perfectFloors: tr.s('Perfect Floors'),
        /* Thesis §55.2: the largest single break is "the one players will screenshot". It took the
           tile "Floors Cleared" held, which the floor headline already says. */
        largestBreak: tr.s('Largest Break'),
        bestScore: tr.s('Best Score')
    },
    /**
     * The curio items the run found and what became of them (`curio-rules.ts`): the run's stranger
     * story, told as chips under its details. Empty when no Curio was opened.
     */
    curioChips: (run: {
        curiosClaimedThisRun?: number;
        crucibleUsesThisRun?: number;
        stormGlassUsesThisRun?: number;
        stillBellUsesThisRun?: number;
        relics?: readonly string[];
    }): string[] => {
        const found = run.curiosClaimedThisRun ?? 0;
        if (found <= 0) return [];
        const used = (name: string, times: number | undefined): string | null => ((times ?? 0) > 0 ? `${name} \u00d7${times}` : null);
        return [
            found === 1 ? tr.s('1 curio found') : tr`${found} curios found`,
            used(tr.s('Crucible'), run.crucibleUsesThisRun),
            used(tr.s('Storm Glass'), run.stormGlassUsesThisRun),
            used(tr.s('Still Bell'), run.stillBellUsesThisRun),
            (run.relics ?? []).includes('misers_purse') ? tr.s("Miser's Purse carried") : null
        ].filter((chip): chip is string => chip !== null);
    },
    /** The largest break's tile value: pairs, because that is the number a screenshot shows. */
    largestBreakValue: (pairs: number): string =>
        pairs <= 0 ? tr.s('None yet') : pairs === 1 ? tr.s('1 pair') : tr`${pairs} pairs`,
    runModeHeadings: {
        daily: (dateKey: string) => tr`Daily ${dateKey}`,
        meditation: tr.s('Meditation descent'),
        puzzle: tr.s('Puzzle descent'),
        scholar: tr.s('Scholar contract'),
        pinVow: tr.s('Pin vow descent'),
        wild: tr.s('Wild run'),
        practice: tr.s('Practice descent'),
        classic: tr.s('Classic descent')
    },
    modeIdentity: {
        meditation: tr.s('Focused comfort: calmer memorize pacing for study and mutator practice.'),
        puzzle: tr.s('Curated challenge: fixed board and local completion tracking.'),
        daily: tr.s('Shared UTC seed: local-only comparison, no online leaderboard.'),
        scholar: tr.s('Scholar contract: no full-board shuffle, stricter memory proof, and contract rewards.'),
        pinVow: tr.s('Pin vow: route planning mattered because pinned notes were capped across the run.'),
        wild: tr.s('Wild Run: joker-style matching pressure stayed attached through the final summary.'),
        practice: tr.s('Practice descent: training rules were explicit, with progression expectations reduced.'),
        /* Every run summary opens with this line; the old "Long-run core: chains and featured
           objectives" was the design's name for the mode, not something said to a player. */
        classic: tr.s('Classic descent: chain matches, keep a miss in the bank, and go as deep as you can.')
    },
    flipHistoryCopy: (flipCount: number) =>
        flipCount > 0
            ? tr`${flipCount} flips recorded locally for this session.`
            : tr.s('No flip history stored for this run.'),
    achievementEyebrow: tr.s('Unlocked'),
    achievementHeading: tr.s('New archive entries'),
    flipTimelineSummary: tr.s('Flip timeline'),
    /**
     * How the run ended, one line under the score. A run ends two ways (thesis §42.2): the player
     * stops, or a floor is still open at its turn ceiling. A contract's mismatch limit and a shared
     * game's last floor are the other two exits the rules have. None of them is a verdict on the
     * player - the ceiling line names the rule, not a failure.
     */
    endReason: {
        turn_ceiling: (floor: number) => tr`Your turns ran out on floor ${floor}.`,
        miss_budget: (floor: number) => tr`You ran out of misses on floor ${floor}.`,
        quit: (floor: number) => tr`You stopped on floor ${floor}.`,
        contract: (floor: number) => tr`The contract's mismatch limit ended the run on floor ${floor}.`,
        pass_and_play_final_floor: (floor: number) => tr`The table played its last floor, floor ${floor}.`,
        warden_cleared: (floor: number) => tr`You cleared the Warden's hall on floor ${floor}. The Descent is won.`,
        rent_unpaid: (floor: number) => tr`Floor ${floor} paid less than its rent, deep in Endless.`,
        slain: (floor: number) => tr`The monsters of floor ${floor} brought you down.`
    } satisfies Record<RunEndReason, (floor: number) => string>
} as const;

/**
 * The end-reason line for a summary, or nothing for one that predates the reason being recorded:
 * an older summary reads as unknown rather than as any one of the four.
 */
/**
 * The Warden's line (DGE-023): how the complete Warden fell, or, for a Descent that ended within
 * three floors of it, how far short and what it would have asked.
 */
export const wardenEndLine = (
    summary: Pick<RunSummary, 'highestLevel' | 'runEndReason'>,
    run: Pick<RunState, 'wardenFelled' | 'endless'> & Partial<Pick<RunState, 'runRulesVersion'>>
): string | null => {
    // The Warden's floor: 40 on the shorter Descent (`descent-length-rules.ts`), 60 before.
    const wardenFloor = descentLengthFor(run.runRulesVersion);
    if (summary.runEndReason === 'warden_cleared') return run.wardenFelled ? tr`Felled by a Hold released at ${WARDEN_FELL_PAIRS} pairs or more.` : null;
    if (run.endless || summary.runEndReason !== 'miss_budget' || summary.highestLevel < wardenFloor - 2) return null;
    const short = wardenFloor - summary.highestLevel;
    const ask = tr`Behind the wild or raging door it falls only to a Hold released at ${WARDEN_FELL_PAIRS} pairs.`;
    return short > 0 ? tr`${plural(short, { one: '{0} floor', other: '{0} floors' })} short of the Warden. ${ask}` : tr`The Warden stood. ${ask}`;
};

/** Where the run ended in the Descent (DGE-007): the act, and how far it fell short of the next boss. */
export const descentEndLine = (descent: DescentRunSummary): string => {
    const where = tr`Floor ${descent.floor} · ${descent.actTitle}${descent.depth > 0 ? tr` · Depth ${descent.depth}` : ''}`;
    if (!descent.next) return where;
    const { name, floorsShort } = descent.next;
    return floorsShort === 0 ? tr`${where} · fell at ${name}` : tr`${where} · ${plural(floorsShort, { one: '{0} floor', other: '{0} floors' })} from ${name}`;
};

/** What was new this run against the profile's record when it began, or nothing. */
export const descentFirstsLine = (descent: DescentRunSummary): string | null =>
    descent.firsts.length > 0 ? tr`New this run: ${descent.firsts.join(', ')}.` : null;

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
    sharedTable,
    testPace,
    powersUsed
}: {
    achievementsEnabled: boolean;
    powersUsed?: boolean;
    practiceMode?: boolean;
    sharedTable?: boolean;
    testPace?: boolean;
}): string => {
    if (achievementsEnabled) {
        return powersUsed === true ? gameOverScreenCopy.achievementsNotePowersUsed : gameOverScreenCopy.achievementsNoteOn;
    }
    if (sharedTable === true) {
        return gameOverScreenCopy.achievementsNoteOffShared;
    }
    if (practiceMode === true) {
        return gameOverScreenCopy.achievementsNoteOffPractice;
    }
    if (testPace === true) {
        return gameOverScreenCopy.achievementsNoteOffTestPace;
    }
    return gameOverScreenCopy.achievementsNoteOff;
};
