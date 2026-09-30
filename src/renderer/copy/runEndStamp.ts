import type { RunEndReason, RunSummary } from '../../shared/contracts';
import { COMBO_HEAT_STAGE_FROM } from '../../shared/combo-heat-rules';

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
    pass_and_play_final_floor: 'TABLE SETTLED'
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

export const RUN_END_STAMP_COPY = {
    kicker: 'Expedition over',
    playAgain: 'PLAY AGAIN',
    rematch: 'REMATCH',
    mainMenu: 'MAIN MENU'
} as const;
