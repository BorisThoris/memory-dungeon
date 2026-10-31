import type { RunEndReason, RunSummary } from '../../shared/contracts';
import { COMBO_HEAT_STAGE_FROM, comboAscension, comboAscensionCallout, comboHeatStageIndex, type ComboHeatTheme } from '../../shared/combo-heat-rules';

/**
 * The run's end as a stamp (`RunEndStamp.tsx`): the verdict word slammed over the results, in the
 * register of the in-run stamps and of the duel screens of the 2000s card cartoons - a word, not a
 * sentence, and never a verdict on the player. Then the choices, as stamps you can press.
 */
export const RUN_END_VERDICT: Record<RunEndReason, string> = {
    miss_budget: 'JOURNEY OVER',
    turn_ceiling: "TIME'S UP",
    quit: 'UNTIL NEXT TIME',
    contract: 'CONTRACT SEALED',
    pass_and_play_final_floor: 'TABLE SETTLED',
    // The Warden cleared (DGE-005): the Descent's one win, never read as a death.
    warden_cleared: 'THE WARDEN FALLS',
    // Endless's rent (DGE-006): the floor paid less than it owed.
    rent_unpaid: 'THE DEPTHS COLLECT',
    // The crawl (rules 104, retired in 105): the hero's health ran out.
    slain: 'SLAIN'
};

/** A summary from before the reason was recorded gets the old title, as a stamp. */
export const RUN_END_VERDICT_UNKNOWN = 'EXPEDITION OVER';

export const runEndVerdict = (reason: RunEndReason | null | undefined): string =>
    reason ? RUN_END_VERDICT[reason] : RUN_END_VERDICT_UNKNOWN;

/** The line under the verdict: the number the run was for, and how far it went. */
export const runEndScoreLine = (totalScore: number, highestLevel: number): string =>
    `${totalScore.toLocaleString()} · Floor ${highestLevel}`;

/**
 * The flourish: a second, smaller stamp for the one thing worth a second stamp. A new record
 * beats a hot run; a hot run is named by the heat its best chain reached.
 */
export const runEndFlourish = (
    summary: Pick<RunSummary, 'bestStreak'>,
    personalBest: 'beaten' | 'matched' | null
): { text: string; tone: 'gold' | 'legendary' | 'inferno' | 'blazing' } | null => {
    if (personalBest === 'beaten') return { text: 'NEW RECORD!', tone: 'gold' };
    if (summary.bestStreak >= COMBO_HEAT_STAGE_FROM.legendary) return { text: 'LEGENDARY RUN', tone: 'legendary' };
    if (summary.bestStreak >= COMBO_HEAT_STAGE_FROM.inferno) return { text: 'INFERNO RUN', tone: 'inferno' };
    if (summary.bestStreak >= COMBO_HEAT_STAGE_FROM.blazing) return { text: 'BLAZING RUN', tone: 'blazing' };
    return null;
};

/**
 * The best combo, replayed (combo reference, "Next on the ladder"): the stamps the run's best combo
 * earned on the way up, flicked through again in the run's own words, then its number. Only a combo
 * that earned a stamp gets one (Hot and up). A combo that ascended many times shows its first
 * ascensions and its last, so the replay stays a beat and not a list.
 */
export interface RunEndComboStamp {
    text: string;
    /** The stage colour index (`ComboHeatTheme.colors`), cold 0 through legendary 5. */
    stage: number;
}

export const RUN_END_REPLAY_MAX_STAMPS = 6;

export const runEndComboReplay = (bestStreak: number, temper: Pick<ComboHeatTheme, 'callouts'>): RunEndComboStamp[] => {
    const stamps: RunEndComboStamp[] = [];
    for (const stage of ['hot', 'blazing', 'inferno', 'legendary'] as const) {
        if (bestStreak >= COMBO_HEAT_STAGE_FROM[stage]) stamps.push({ text: temper.callouts[stage], stage: comboHeatStageIndex(stage) });
    }
    const ascensions: RunEndComboStamp[] = [];
    for (let ascension = 2; ascension <= comboAscension(bestStreak); ascension += 1) {
        ascensions.push({ text: comboAscensionCallout(temper.callouts.legendary, ascension), stage: 5 });
    }
    const room = RUN_END_REPLAY_MAX_STAMPS - stamps.length;
    if (ascensions.length <= room) return [...stamps, ...ascensions];
    return [...stamps, ...ascensions.slice(0, room - 1), ascensions.at(-1)!];
};

/** The line the replay lands on. */
export const runEndComboLine = (bestStreak: number): string => `Best combo ×${bestStreak}`;

export const RUN_END_STAMP_COPY = {
    kicker: 'Expedition over',
    playAgain: 'PLAY AGAIN',
    rematch: 'REMATCH',
    mainMenu: 'MAIN MENU',
    record: 'RESULTS',
    skipHint: 'Press anything to continue'
} as const;
