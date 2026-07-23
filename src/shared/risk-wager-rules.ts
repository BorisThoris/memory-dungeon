import {
    ENDLESS_RISK_WAGER_BONUS_FAVOR,
    ENDLESS_RISK_WAGER_MIN_STREAK,
    type RunState
} from './contracts';
import { usesEndlessFloorSchedule } from './floor-mutator-schedule';
import { runNonNegativeInteger } from './run-number-guards';

export const canOfferEndlessRiskWager = (run: RunState): boolean =>
    run.status === 'levelComplete' &&
    run.relicOffer == null &&
    run.gameMode === 'endless' &&
    usesEndlessFloorSchedule(run.gameMode, run.runRulesVersion) &&
    run.endlessRiskWager == null &&
    run.lastLevelResult?.featuredObjectiveId != null &&
    run.lastLevelResult.featuredObjectiveCompleted === true &&
    runNonNegativeInteger(run.featuredObjectiveStreak) >= ENDLESS_RISK_WAGER_MIN_STREAK;

export const acceptEndlessRiskWager = (run: RunState): RunState => {
    if (!canOfferEndlessRiskWager(run) || !run.lastLevelResult) {
        return run;
    }

    return {
        ...run,
        endlessRiskWager: {
            acceptedOnLevel: run.lastLevelResult.level,
            targetLevel: run.lastLevelResult.level + 1,
            streakAtRisk: runNonNegativeInteger(run.featuredObjectiveStreak),
            bonusFavorOnSuccess: ENDLESS_RISK_WAGER_BONUS_FAVOR
        }
    };
};
